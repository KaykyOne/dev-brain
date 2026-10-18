import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function load(appUrl?: string) {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/db");
  if (appUrl !== undefined) vi.stubEnv("APP_URL", appUrl);
  return import("./env");
}

beforeEach(() => vi.stubEnv("APP_URL", ""));
afterEach(() => vi.unstubAllEnvs());

describe("basePath derivado de APP_URL", () => {
  it("extrai o prefixo do caminho", async () => {
    const { basePath, env } = await load("https://vps.kayky.dev.br/ai");
    expect(basePath).toBe("/ai");
    expect(env.APP_URL).toBe("https://vps.kayky.dev.br/ai");
  });

  it("ignora barras finais", async () => {
    const { basePath, env } = await load("https://vps.kayky.dev.br/ai/");
    expect(basePath).toBe("/ai");
    expect(env.APP_URL).toBe("https://vps.kayky.dev.br/ai");
  });

  it("é vazio quando o app roda na raiz", async () => {
    expect((await load("https://exemplo.com")).basePath).toBe("");
    expect((await load("https://exemplo.com/")).basePath).toBe("");
  });
});
