"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { aiSettings } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { fail, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/dal";
import { env } from "@/lib/env";
import { encryptSecret } from "@/lib/security/app-secret";
import { aiSettingsSchema } from "@/lib/validations/ai-settings";

import { apiKeyHint } from "./settings";

/** Salva a configuração do assistente. A chave só muda quando uma nova é digitada (ou removida). */
export async function saveAiSettings(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();

  const parsed = aiSettingsSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos", z.flattenError(parsed.error).fieldErrors);
  const { provider, apiKey, removeApiKey, model, baseUrl, thinking, maxSteps } = parsed.data;

  const [existing] = await db.select().from(aiSettings).where(eq(aiSettings.ownerId, user.id)).limit(1);

  // Primeira vez: sem chave nova, a do .env passa para cá, para o assistente não desligar ao salvar.
  const previous = existing
    ? { ciphertext: existing.apiKeyCiphertext, hint: existing.apiKeyHint }
    : env.AI_API_KEY
      ? { ciphertext: await encryptSecret(env.AI_API_KEY), hint: apiKeyHint(env.AI_API_KEY) }
      : { ciphertext: null, hint: null };

  const key = removeApiKey
    ? { ciphertext: null, hint: null }
    : apiKey
      ? { ciphertext: await encryptSecret(apiKey), hint: apiKeyHint(apiKey) }
      : previous;

  const values = {
    provider,
    apiKeyCiphertext: key.ciphertext,
    apiKeyHint: key.hint,
    model: model || null,
    baseUrl: baseUrl || null,
    thinking: provider === "deepseek" && thinking,
    maxSteps,
    updatedAt: new Date(),
  };

  await db
    .insert(aiSettings)
    .values({ ownerId: user.id, ...values })
    .onConflictDoUpdate({ target: aiSettings.ownerId, set: values });

  await logActivity({
    action: "settings.ai_updated",
    actorId: user.id,
    metadata: { provider, model: values.model, keyChanged: !!apiKey || removeApiKey },
  });

  return { ok: true, data: undefined };
}
