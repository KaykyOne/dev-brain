import { describe, expect, it } from "vitest";

import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("bloqueia após o limite e libera na nova janela", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 1000 });

    expect(check("a", 0).allowed).toBe(true);
    expect(check("a", 100).allowed).toBe(true);
    expect(check("a", 200)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(check("b", 200).allowed).toBe(true);
    expect(check("a", 1000).allowed).toBe(true);
  });
});
