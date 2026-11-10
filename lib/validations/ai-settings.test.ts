import { describe, expect, it } from "vitest";

import { aiSettingsSchema } from "./ai-settings";

const base = {
  provider: "deepseek" as const,
  apiKey: "",
  removeApiKey: false,
  model: "",
  baseUrl: "",
  thinking: false,
  maxSteps: 12,
};

const errorsOf = (input: unknown) => {
  const result = aiSettingsSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
};

describe("aiSettingsSchema", () => {
  it("aceita o DeepSeek sem modelo (tem padrão) e sem trocar a chave", () => {
    expect(errorsOf(base)).toEqual([]);
  });

  it("exige modelo fora do DeepSeek e URL no provedor personalizado", () => {
    expect(errorsOf({ ...base, provider: "openai" })).toEqual(["model"]);
    expect(errorsOf({ ...base, provider: "custom", model: "m" })).toEqual(["baseUrl"]);
    expect(errorsOf({ ...base, provider: "custom", model: "m", baseUrl: "https://proxy.local/v1" })).toEqual([]);
  });

  it("recusa URL inválida, chave com espaço e passos fora do limite", () => {
    expect(errorsOf({ ...base, baseUrl: "proxy" })).toEqual(["baseUrl"]);
    expect(errorsOf({ ...base, apiKey: "sk 123" })).toEqual(["apiKey"]);
    expect(errorsOf({ ...base, maxSteps: 0 })).toEqual(["maxSteps"]);
    expect(errorsOf({ ...base, maxSteps: 31 })).toEqual(["maxSteps"]);
  });

  it("recusa provedor desconhecido", () => {
    expect(errorsOf({ ...base, provider: "outro" })).toEqual(["provider"]);
  });
});
