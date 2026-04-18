#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

import OpenAI from "openai";
import pdf from "pdf-parse";

const config = {
  openAiApiKey: process.env.OPENAI_API_KEY,
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  qdrantUrl: process.env.QDRANT_URL || "http://localhost:6333",
  qdrantCollection: process.env.QDRANT_COLLECTION || "sggs_chunks",
  pdfUrl:
    process.env.SGGS_PDF_URL ||
    "https://www.sikhnet.com/files/ereader/SGGS%20%5BGurmukhi%5D.pdf",
};

const openai = new OpenAI({ apiKey: config.openAiApiKey });

const normalizeWhitespace = (value) =>
  value
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const splitIntoSegments = (text) => {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const segments = [];
  let current = [];

  for (const line of lines) {
    current.push(line);
    const endsLikeVerse = /॥\d*॥?$/.test(line) || line.includes("ਰਹਾਉ");
    if (endsLikeVerse) {
      segments.push(current.join("\n"));
      current = [];
    }
  }

  if (current.length > 0) {
    segments.push(current.join("\n"));
  }

  return segments.map(normalizeWhitespace).filter(Boolean);
};

const chunkText = (text, chunkSize = 1000, overlap = 200) => {
  const clean = normalizeWhitespace(text);
  if (!clean) return [];

  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(clean.length, start + chunkSize);
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks.filter(Boolean);
};

const parseCliArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {
    pdfPath: null,
    fromPage: 1,
    toPage: Infinity,
  };

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--pdf" && args[i + 1]) {
      parsed.pdfPath = path.resolve(args[i + 1]);
      i += 1;
    } else if (args[i] === "--from" && args[i + 1]) {
      parsed.fromPage = Number(args[i + 1]) || 1;
      i += 1;
    } else if (args[i] === "--to" && args[i + 1]) {
      parsed.toPage = Number(args[i + 1]) || Infinity;
      i += 1;
    }
  }

  return parsed;
};

const getPdfBuffer = async (pdfPath) => {
  if (pdfPath) {
    return fs.readFile(pdfPath);
  }

  const response = await fetch(config.pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const extractPages = async (pdfBuffer) => {
  const pages = [];

  await pdf(pdfBuffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join("\n");
      pages.push(normalizeWhitespace(pageText));
      return pageText;
    },
  });

  return pages;
};

const ensureCollection = async (vectorSize) => {
  const response = await fetch(`${config.qdrantUrl}/collections/${config.qdrantCollection}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to create/update collection: ${message}`);
  }
};

const upsertPoints = async (points) => {
  const response = await fetch(
    `${config.qdrantUrl}/collections/${config.qdrantCollection}/points?wait=true`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to upsert points: ${message}`);
  }
};

const main = async () => {
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required.");
  }

  const { pdfPath, fromPage, toPage } = parseCliArgs();
  const pdfBuffer = await getPdfBuffer(pdfPath);
  const pages = await extractPages(pdfBuffer);

  const allChunks = [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pageNumber = pageIndex + 1;
    if (pageNumber < fromPage || pageNumber > toPage) continue;

    const segments = splitIntoSegments(pages[pageIndex]);
    let chunkIndex = 0;

    segments.forEach((segment, segmentIndex) => {
      chunkText(segment).forEach((chunk) => {
        allChunks.push({
          id: `p${pageNumber}-c${chunkIndex}`,
          page: pageNumber,
          chunkIndex,
          shabadHeuristicId: `p${pageNumber}-s${segmentIndex}`,
          text: chunk,
        });
        chunkIndex += 1;
      });
    });
  }

  if (allChunks.length === 0) {
    throw new Error("No chunks produced from the selected page range.");
  }

  const embeddings = [];
  const batchSize = 50;

  for (let i = 0; i < allChunks.length; i += batchSize) {
    const slice = allChunks.slice(i, i + batchSize);
    const embeddingResponse = await openai.embeddings.create({
      model: config.embeddingModel,
      input: slice.map((item) => item.text),
    });

    embeddingResponse.data.forEach((row, rowIndex) => {
      embeddings.push({
        id: slice[rowIndex].id,
        vector: row.embedding,
        payload: {
          source: "SGGS_PDF",
          page: slice[rowIndex].page,
          chunkIndex: slice[rowIndex].chunkIndex,
          text: slice[rowIndex].text,
          shabadHeuristicId: slice[rowIndex].shabadHeuristicId,
        },
      });
    });

    console.log(`Embedded ${Math.min(i + batchSize, allChunks.length)}/${allChunks.length}`);
  }

  await ensureCollection(embeddings[0].vector.length);

  const upsertBatchSize = 128;
  for (let i = 0; i < embeddings.length; i += upsertBatchSize) {
    const slice = embeddings.slice(i, i + upsertBatchSize);
    await upsertPoints(slice);
    console.log(`Upserted ${Math.min(i + upsertBatchSize, embeddings.length)}/${embeddings.length}`);
  }

  console.log("Ingest complete.");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
