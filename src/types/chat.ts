export type ChatMode = "quick" | "deep";
export type OutputLanguage = "de" | "en";

export interface ChatRequestBody {
  question: string;
  mode: ChatMode;
  language: OutputLanguage;
  allowYouTube?: boolean;
}

export interface Citation {
  page: number;
  gurmukhiExcerpt: string;
  source: "SGGS_PDF" | "YOUTUBE";
}

export interface ChatResponseBody {
  answer: string;
  citations: Citation[];
  confidence: number;
  needsClarification?: boolean;
}
