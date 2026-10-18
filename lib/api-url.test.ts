import { afterEach, describe, expect, it, vi } from "vitest";

import { apiUrl } from "./api-url";

afterEach(() => vi.unstubAllEnvs());

describe("apiUrl", () => {
  it("prefixa com o basePath", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/ai");
    expect(apiUrl("/api/auth/login")).toBe("/ai/api/auth/login");
  });

  it("não altera o caminho na raiz", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
    expect(apiUrl("/api/auth/login")).toBe("/api/auth/login");
  });
});
