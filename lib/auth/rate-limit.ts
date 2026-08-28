const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_KEY = 8;

const hits = new Map<string, number[]>();

export function rateLimit(key: string, max = MAX_PER_KEY): boolean {
  const now = Date.now();
  const next = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (next.length >= max) {
    hits.set(key, next);
    return false;
  }
  next.push(now);
  hits.set(key, next);
  return true;
}
