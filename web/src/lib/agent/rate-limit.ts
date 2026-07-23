/**
 * In-memory IP rate limiter. Resets on process restart (acceptable for single-VPS).
 * Configure via AGENT_RATE_LIMIT env var (default: 20 queries/day per IP).
 */

interface Entry {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const map = new Map<string, Entry>();

export function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const limit = parseInt(process.env.AGENT_RATE_LIMIT ?? '20', 10);
  const now = Date.now();
  const entry = map.get(ip);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + WINDOW_MS;
    map.set(ip, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// Prune expired entries every hour to prevent unbounded map growth
setInterval(
  () => {
    const now = Date.now();
    for (const [ip, entry] of map.entries()) {
      if (now > entry.resetAt) map.delete(ip);
    }
  },
  60 * 60 * 1000,
);
