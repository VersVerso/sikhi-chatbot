const toBool = (value: string | undefined, defaultValue = false): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === "true";
};

const toNumber = (value: string | undefined, defaultValue: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

export const appConfig = {
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  qdrantUrl: process.env.QDRANT_URL ?? "http://localhost:6333",
  qdrantCollection: process.env.QDRANT_COLLECTION ?? "sggs_chunks",
  topK: toNumber(process.env.RAG_TOP_K, 8),
  minConfidence: toNumber(process.env.RAG_MIN_CONFIDENCE, 0.25),
  maxContextPoints: toNumber(process.env.RAG_MAX_CONTEXT_POINTS, 16),
  allowYouTubeSources: toBool(process.env.ALLOW_YOUTUBE_SOURCES, false),
  appBaseUrl: process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:3000",
} as const;

export const getMissingRuntimeConfigKeys = (): string[] => {
  const missing: string[] = [];
  if (!appConfig.openAiApiKey) missing.push("OPENAI_API_KEY");
  return missing;
};

export const hasRequiredRuntimeConfig = (): boolean =>
  getMissingRuntimeConfigKeys().length === 0;
