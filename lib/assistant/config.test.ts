import { describe, expect, it } from "vitest";

import { publicStatus, resolveAiConfig, type AiEnv } from "./config";

const base: AiEnv = { AI_PROVIDER: "deepseek", AI_THINKING: "disabled", AI_MAX_STEPS: 12 };

describe("resolveAiConfig", () => {
  it("fica desativado sem chave, com instrução clara", () => {
    const config = resolveAiConfig(base);
    expect(config.enabled).toBe(false);
    expect(config.enabled === false && config.reason).toContain("AI_API_KEY");
  });

  it("vem pré-configurado para o DeepSeek Flash: só falta a chave", () => {
    const config = resolveAiConfig({ ...base, AI_API_KEY: "sk-teste" });
    expect(config).toMatchObject({ enabled: true, baseUrl: "https://api.deepseek.com", model: "deepseek-flash", thinking: false });
  });

  it("aceita sobrescrever modelo e URL", () => {
    const config = resolveAiConfig({ ...base, AI_API_KEY: "k", AI_MODEL: "outro", AI_BASE_URL: "https://proxy.local/v1/" });
    expect(config).toMatchObject({ model: "outro", baseUrl: "https://proxy.local/v1" });
  });

  it("liga o modo de raciocínio só no DeepSeek", () => {
    expect(resolveAiConfig({ ...base, AI_API_KEY: "k", AI_THINKING: "enabled" })).toMatchObject({ thinking: true });
    expect(resolveAiConfig({ ...base, AI_PROVIDER: "openai", AI_MODEL: "m", AI_API_KEY: "k", AI_THINKING: "enabled" })).toMatchObject({
      thinking: false,
    });
  });

  it("exige modelo fora do DeepSeek e URL no provedor custom", () => {
    expect(resolveAiConfig({ ...base, AI_PROVIDER: "openai", AI_API_KEY: "k" })).toMatchObject({ enabled: false });
    expect(resolveAiConfig({ ...base, AI_PROVIDER: "openai", AI_API_KEY: "k", AI_MODEL: "m" })).toMatchObject({
      enabled: true,
      baseUrl: "https://api.openai.com/v1",
    });
    expect(resolveAiConfig({ ...base, AI_PROVIDER: "custom", AI_API_KEY: "k", AI_MODEL: "m" })).toMatchObject({ enabled: false });
    expect(resolveAiConfig({ ...base, AI_PROVIDER: "custom", AI_API_KEY: "k", AI_MODEL: "m", AI_BASE_URL: "http://x/v1" })).toMatchObject({
      enabled: true,
    });
  });
});

describe("publicStatus", () => {
  it("nunca expõe a chave nem a URL", () => {
    const config = resolveAiConfig({ ...base, AI_API_KEY: "sk-segredo" });
    const text = JSON.stringify(publicStatus(config));
    expect(text).not.toContain("sk-segredo");
    expect(text).not.toContain("api.deepseek.com");
    expect(publicStatus(config)).toEqual({ enabled: true, provider: "deepseek", model: "deepseek-flash", reason: null });
  });
});
