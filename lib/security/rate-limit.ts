type Bucket = { count: number; resetAt: number };

/**
 * Janela fixa em memória, por chave. Suficiente para uma instância única;
 * com várias instâncias, trocar por um store compartilhado.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const buckets = new Map<string, Bucket>();

  return function check(key: string, now = Date.now()) {
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    bucket.count += 1;
    return {
      allowed: bucket.count <= limit,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  };
}
