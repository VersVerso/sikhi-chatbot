const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

type Counter = {
  count: number;
  resetAt: number;
};

const memoryStore = new Map<string, Counter>();

export const checkRateLimit = (key: string): { limited: boolean; retryAfterSeconds: number } => {
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || now >= existing.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) };
  }

  existing.count += 1;

  if (existing.count > MAX_REQUESTS_PER_WINDOW) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return {
    limited: false,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
};
