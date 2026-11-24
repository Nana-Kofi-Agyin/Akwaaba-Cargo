type RateLimitEntry = {
  timestamps: number[];
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

/**
 * Lightweight in-memory sliding-window rate limiter.
 * Suitable for per-instance serverless protection with zero external dependencies.
 */
export function createRateLimiter(options: {
  maxRequests: number;
  windowMs: number;
}) {
  const store = new Map<string, RateLimitEntry>();
  let lastPrune = Date.now();

  function prune(now: number) {
    if (now - lastPrune < options.windowMs) return;
    lastPrune = now;
    const cutoff = now - options.windowMs;
    for (const [key, entry] of store.entries()) {
      const active = entry.timestamps.filter((t) => t > cutoff);
      if (active.length === 0) {
        store.delete(key);
      } else {
        entry.timestamps = active;
      }
    }
  }

  return function check(key: string, now = Date.now()): RateLimitResult {
    prune(now);

    const cutoff = now - options.windowMs;
    const existing = store.get(key);
    const active = existing
      ? existing.timestamps.filter((t) => t > cutoff)
      : [];

    if (active.length >= options.maxRequests) {
      const oldest = active[0];
      const retryAfterMs = Math.max(1000, oldest + options.windowMs - now);
      store.set(key, { timestamps: active });
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.ceil(retryAfterMs / 1000),
      };
    }

    active.push(now);
    store.set(key, { timestamps: active });

    return {
      allowed: true,
      remaining: Math.max(0, options.maxRequests - active.length),
      retryAfterSec: 0,
    };
  };
}

/**
 * Extract the best-effort client IP address from Vercel / proxy request headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
