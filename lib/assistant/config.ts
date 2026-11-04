/**
 * Configuração do provedor de IA (puro, sem acesso a segredos do cliente). A entrada vem de Configurações
 * (tabela ai_settings) ou, enquanto nada foi salvo lá, das variáveis de ambiente.
 */

export type AiEnv = {
  AI_PROVIDER: "deepseek" | "openai" | "openrouter" | "custom";
  AI_API_KEY?: string;
  AI_MODEL?: string;
  AI_BASE_URL?: string;
  AI_THINKING: "enabled" | "disabled";
  AI_MAX_STEPS: number;
};

type Preset = { baseUrl?: string; model?: string };

export const AI_PROVIDERS = {
  deepseek: "DeepSeek",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  custom: "Outro (compatível com a API da OpenAI)",
} as const satisfies Record<AiEnv["AI_PROVIDER"], string>;

/** Todos falam a API de chat completions da OpenAI. Só o DeepSeek tem modelo padrão. */
export const PRESETS: Record<AiEnv["AI_PROVIDER"], Preset> = {
  deepseek: { baseUrl: "https://api.deepseek.com", model: "deepseek-flash" },
  openai: { baseUrl: "https://api.openai.com/v1" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1" },
  custom: {},
};

export type AiConfig =
  | { enabled: false; provider: AiEnv["AI_PROVIDER"]; reason: string }
  | {
      enabled: true;
      provider: AiEnv["AI_PROVIDER"];
      baseUrl: string;
      model: string;
      apiKey: string;
      /** Envia `thinking` na requisição (extensão do DeepSeek). */
      thinking: boolean;
      maxSteps: number;
    };

export function resolveAiConfig(env: AiEnv): AiConfig {
  const provider = env.AI_PROVIDER;
  const preset = PRESETS[provider];

  if (!env.AI_API_KEY) return { enabled: false, provider, reason: "Informe a chave de API em Configurações para ativar o assistente." };

  const model = env.AI_MODEL ?? preset.model;
  if (!model) return { enabled: false, provider, reason: `Informe o modelo em Configurações: o provedor "${provider}" não tem modelo padrão.` };

  const baseUrl = (env.AI_BASE_URL ?? preset.baseUrl)?.replace(/\/+$/, "");
  if (!baseUrl) return { enabled: false, provider, reason: "Informe a URL da API em Configurações para o provedor personalizado." };

  return {
    enabled: true,
    provider,
    baseUrl,
    model,
    apiKey: env.AI_API_KEY,
    thinking: provider === "deepseek" && env.AI_THINKING === "enabled",
    maxSteps: env.AI_MAX_STEPS,
  };
}

/** O que o navegador pode saber: nunca a chave nem a URL interna. */
export type AiPublicStatus = { enabled: boolean; provider: string; model: string | null; reason: string | null };

export function publicStatus(config: AiConfig, model?: string): AiPublicStatus {
  return config.enabled
    ? { enabled: true, provider: config.provider, model: config.model, reason: null }
    : { enabled: false, provider: config.provider, model: model ?? null, reason: config.reason };
}
