import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { aiSettings } from "@/db/schema";
import { env } from "@/lib/env";
import { decryptSecret } from "@/lib/security/app-secret";

import { resolveAiConfig, type AiConfig, type AiEnv } from "./config";

/** Últimos caracteres da chave, para o usuário reconhecê-la sem expor o valor. */
export const apiKeyHint = (key: string) => `…${key.slice(-4)}`;

const findSettings = async (ownerId: string) =>
  (await db.select().from(aiSettings).where(eq(aiSettings.ownerId, ownerId)).limit(1))[0] ?? null;

/** Entrada do assistente: o que foi salvo em Configurações ou, enquanto nada foi salvo, o .env. */
async function loadAiEnv(ownerId: string): Promise<{ source: "settings" | "env"; values: AiEnv; hint: string | null }> {
  const row = await findSettings(ownerId);
  if (!row) return { source: "env", values: env, hint: env.AI_API_KEY ? apiKeyHint(env.AI_API_KEY) : null };

  const apiKey = row.apiKeyCiphertext ? await decryptSecret(row.apiKeyCiphertext, "chave de API da IA") : null;
  return {
    source: "settings",
    hint: row.apiKeyHint,
    values: {
      AI_PROVIDER: row.provider,
      AI_API_KEY: apiKey ?? undefined,
      AI_MODEL: row.model ?? undefined,
      AI_BASE_URL: row.baseUrl ?? undefined,
      AI_THINKING: row.thinking ? "enabled" : "disabled",
      AI_MAX_STEPS: row.maxSteps,
    },
  };
}

/** Configuração resolvida do assistente da conta (com a chave em claro: só no servidor). */
export async function loadAiConfig(ownerId: string): Promise<AiConfig> {
  return resolveAiConfig((await loadAiEnv(ownerId)).values);
}

/** O que o formulário de Configurações mostra: tudo, menos a chave (só se existe e o final dela). */
export async function getAiSettingsView(ownerId: string) {
  const { source, values, hint } = await loadAiEnv(ownerId);

  return {
    source,
    provider: values.AI_PROVIDER,
    model: values.AI_MODEL ?? "",
    baseUrl: values.AI_BASE_URL ?? "",
    thinking: values.AI_THINKING === "enabled",
    maxSteps: values.AI_MAX_STEPS,
    apiKey: { saved: !!values.AI_API_KEY, hint },
    status: resolveAiConfig(values),
  };
}
