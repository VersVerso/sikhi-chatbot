import { appConfig } from "@/lib/config";

interface QdrantPointPayload {
  source: "SGGS_PDF" | "YOUTUBE";
  page: number;
  chunkIndex: number;
  text: string;
  shabadHeuristicId: string;
}

export interface VectorPoint {
  id: string | number;
  score?: number;
  payload: QdrantPointPayload;
}

const qdrantRequest = async <T>(
  path: string,
  method: "GET" | "POST" | "PUT",
  body?: unknown,
): Promise<T> => {
  const response = await fetch(`${appConfig.qdrantUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qdrant error (${response.status}): ${errorText}`);
  }

  return (await response.json()) as T;
};

export const searchVectors = async (
  vector: number[],
  topK: number,
  includeYouTube: boolean,
): Promise<VectorPoint[]> => {
  type SearchResponse = { result: Array<{ id: string | number; score: number; payload: QdrantPointPayload }> };

  const sourceFilter = includeYouTube
    ? undefined
    : {
        must: [{ key: "source", match: { value: "SGGS_PDF" } }],
      };

  const response = await qdrantRequest<SearchResponse>(
    `/collections/${appConfig.qdrantCollection}/points/search`,
    "POST",
    {
      vector,
      limit: topK,
      with_payload: true,
      filter: sourceFilter,
    },
  );

  return response.result.map((item) => ({
    id: item.id,
    score: item.score,
    payload: item.payload,
  }));
};

export const scrollVectors = async (filter: unknown, limit: number): Promise<VectorPoint[]> => {
  type ScrollResponse = {
    result: {
      points: Array<{ id: string | number; payload: QdrantPointPayload }>;
    };
  };

  const response = await qdrantRequest<ScrollResponse>(
    `/collections/${appConfig.qdrantCollection}/points/scroll`,
    "POST",
    {
      with_payload: true,
      limit,
      filter,
    },
  );

  return (response.result?.points ?? []).map((point) => ({
    id: point.id,
    payload: point.payload,
  }));
};
