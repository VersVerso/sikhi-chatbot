export interface RawChunk {
  text: string;
  page: number;
  chunkIndex: number;
  shabadHeuristicId: string;
}

const normalizeWhitespace = (value: string): string =>
  value
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const splitIntoSegments = (text: string): string[] => {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const segments: string[] = [];
  let current: string[] = [];

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

const chunkText = (text: string, chunkSize: number, overlap: number): string[] => {
  const clean = normalizeWhitespace(text);
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    const end = Math.min(clean.length, start + chunkSize);
    chunks.push(clean.slice(start, end).trim());

    if (end >= clean.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks.filter(Boolean);
};

export const buildChunksForPage = (
  pageText: string,
  page: number,
  chunkSize = 1000,
  overlap = 200,
): RawChunk[] => {
  const segments = splitIntoSegments(pageText);
  const chunks: RawChunk[] = [];
  let chunkIndex = 0;

  segments.forEach((segment, segmentIndex) => {
    const segmentChunks = chunkText(segment, chunkSize, overlap);
    segmentChunks.forEach((chunk) => {
      chunks.push({
        text: chunk,
        page,
        chunkIndex,
        shabadHeuristicId: `p${page}-s${segmentIndex}`,
      });
      chunkIndex += 1;
    });
  });

  return chunks;
};
