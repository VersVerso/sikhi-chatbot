import OpenAI from "openai";

import { appConfig } from "@/lib/config";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompt";
import { scrollVectors, searchVectors, type VectorPoint } from "@/lib/qdrant";
import type { ChatMode, ChatResponseBody, OutputLanguage } from "@/types/chat";

const openaiClient = new OpenAI({ apiKey: appConfig.openAiApiKey });
const FALLBACK_EXCERPT_LENGTH = 220;
const QUICK_MODE_CITATION_COUNT = 1;
const DEEP_MODE_CITATION_COUNT = 3;

const interpretationLabel = (language: OutputLanguage): string =>
  language === "de"
    ? "Erläuterung/Interpretation"
    : "Explanation/Interpretation (Erläuterung/Interpretation)";

const toContextLine = (point: VectorPoint): string =>
  `[page=${point.payload.page}; chunk=${point.payload.chunkIndex}; shabad=${point.payload.shabadHeuristicId}] ${point.payload.text}`;

const uniqueByText = (points: VectorPoint[]): VectorPoint[] => {
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = `${point.payload.page}:${point.payload.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const expandContext = async (hits: VectorPoint[]): Promise<VectorPoint[]> => {
  const expanded: VectorPoint[] = [...hits];

  for (const hit of hits) {
    const filter = {
      must: [
        { key: "source", match: { value: "SGGS_PDF" } },
        {
          should: [
            { key: "shabadHeuristicId", match: { value: hit.payload.shabadHeuristicId } },
            {
              must: [
                { key: "page", range: { gte: hit.payload.page - 1, lte: hit.payload.page + 1 } },
                {
                  key: "chunkIndex",
                  range: { gte: hit.payload.chunkIndex - 1, lte: hit.payload.chunkIndex + 1 },
                },
              ],
            },
          ],
          min_should: 1,
        },
      ],
    };

    const neighbors = await scrollVectors(filter, 12);
    expanded.push(...neighbors);
  }

  return uniqueByText(expanded).slice(0, appConfig.maxContextPoints);
};

const estimateConfidence = (hits: VectorPoint[]): number => {
  if (hits.length === 0) return 0;
  const avg =
    hits.reduce((sum, hit) => sum + (typeof hit.score === "number" ? hit.score : 0), 0) /
    Math.max(1, hits.length);
  return Number(avg.toFixed(3));
};

const ensureInterpretationLabel = (answer: string, language: OutputLanguage): string =>
  /Erläuterung\/Interpretation:|Explanation\/Interpretation/i.test(answer.trim())
    ? answer
    : `${interpretationLabel(language)}: ${answer.trim()}`;

const parseModelJson = (content: string): Pick<ChatResponseBody, "answer" | "citations"> => {
  const parsed = JSON.parse(content) as { answer?: unknown; citations?: unknown };

  const answer = typeof parsed.answer === "string" ? parsed.answer : "";
  const citations = Array.isArray(parsed.citations)
    ? parsed.citations
        .map((citation) => {
          if (!citation || typeof citation !== "object") return null;
          const maybeCitation = citation as { page?: unknown; gurmukhiExcerpt?: unknown; source?: unknown };
          if (
            typeof maybeCitation.page !== "number" ||
            typeof maybeCitation.gurmukhiExcerpt !== "string" ||
            maybeCitation.source !== "SGGS_PDF"
          ) {
            return null;
          }
          return {
            page: maybeCitation.page,
            gurmukhiExcerpt: maybeCitation.gurmukhiExcerpt,
            source: "SGGS_PDF" as const,
          };
        })
        .filter((citation): citation is { page: number; gurmukhiExcerpt: string; source: "SGGS_PDF" } =>
          Boolean(citation),
        )
    : [];

  return { answer, citations };
};

export const answerWithRag = async (
  question: string,
  mode: ChatMode,
  language: OutputLanguage,
  allowYouTube: boolean,
): Promise<ChatResponseBody> => {
  const embedding = await openaiClient.embeddings.create({
    model: appConfig.embeddingModel,
    input: question,
  });

  const queryVector = embedding.data[0]?.embedding;
  if (!queryVector) {
    throw new Error("Embedding generation failed.");
  }

  const hits = await searchVectors(queryVector, appConfig.topK, allowYouTube && appConfig.allowYouTubeSources);
  const confidence = estimateConfidence(hits);

  if (hits.length === 0 || confidence < appConfig.minConfidence) {
    const fallbackAnswer =
      language === "de"
        ? "Ich konnte in den verfügbaren SGGS-Quellen keine ausreichend sichere Stelle finden. Kannst du die Frage genauer eingrenzen (Thema, Shabad, oder Schlüsselwörter)?"
        : "I could not confidently find the source in the available SGGS context. Could you narrow the question (topic, shabad, or key words)?";

    return {
      answer: ensureInterpretationLabel(fallbackAnswer, language),
      citations: [],
      confidence,
      needsClarification: true,
    };
  }

  const expanded = await expandContext(hits);
  const context = expanded.map(toContextLine).join("\n\n");

  const completion = await openaiClient.chat.completions.create({
    model: appConfig.openAiModel,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(mode, language),
      },
      {
        role: "user",
        content: buildUserPrompt(question, context),
      },
    ],
    response_format: { type: "json_object" },
  });

  const rawOutput = completion.choices[0]?.message?.content?.trim();
  if (!rawOutput) {
    throw new Error("Model returned empty output.");
  }

  const parsed = parseModelJson(rawOutput);
  const fallbackCitations = expanded
    .slice(0, mode === "quick" ? QUICK_MODE_CITATION_COUNT : DEEP_MODE_CITATION_COUNT)
    .map((point) => ({
    page: point.payload.page,
    gurmukhiExcerpt: point.payload.text.slice(0, FALLBACK_EXCERPT_LENGTH),
    source: "SGGS_PDF" as const,
    }));

  return {
    answer: ensureInterpretationLabel(
      parsed.answer || (language === "de" ? "Keine Antwort generiert." : "No answer generated."),
      language,
    ),
    citations: parsed.citations.length > 0 ? parsed.citations : fallbackCitations,
    confidence,
  };
};
