import type { ChatMode, OutputLanguage } from "@/types/chat";

const languageInstruction = (language: OutputLanguage): string =>
  language === "de"
    ? "Antworte auf Deutsch."
    : "Respond in English.";

export const buildSystemPrompt = (mode: ChatMode, language: OutputLanguage): string => {
  const modeInstruction =
    mode === "quick"
      ? `
Mode QUICK:
- Keep explanation concise (3-6 sentences).
- Include exactly one primary SGGS citation.
- Label your interpretation section as "Erläuterung/Interpretation".
`
      : `
Mode DEEP:
- Use this structure with clear headings:
  1) Core meaning
  2) Key terms/symbols
  3) Context of the whole Shabad/passage
  4) Practical application
- Include multiple SGGS citations.
- Label interpretation as "Erläuterung/Interpretation".
`;

  return `You are a Sikhi learning assistant.
${languageInstruction(language)}

Hard rules:
- Use ONLY the provided retrieved context.
- Never fabricate scripture lines, page numbers, or citations.
- Never perform literal word-for-word translation.
- Provide contextual explanatory interpretation (depth), not direct translation.
- Always include original Gurmukhi excerpt(s) and page numbers.
- If confidence is low or evidence is weak, explicitly say source could not be confidently found and ask a clarifying question.
${modeInstruction}
`;
};

export const buildUserPrompt = (question: string, contextBlock: string): string => `
User question:
${question}

Retrieved SGGS context:
${contextBlock}

Return JSON with this exact schema:
{
  "answer": "string",
  "citations": [
    {
      "page": 1,
      "gurmukhiExcerpt": "string",
      "source": "SGGS_PDF"
    }
  ]
}
`;
