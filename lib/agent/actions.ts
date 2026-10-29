"use server";

import { logActivity } from "@/lib/activity";
import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/dal";

import { issueAccessKey, revokeAllAgentTokens } from "./issue";

/** Gera a chave de acesso do MCP, revogando as anteriores. O valor em claro só aparece aqui. */
export async function generateAccessKey(): Promise<ActionResult<{ token: string; prefix: string }>> {
  const user = await getCurrentUser();

  const { id, token, prefix } = await issueAccessKey(user.id);
  await logActivity({ action: "token.created", actorId: user.id, metadata: { tokenId: id, scope: "account" } });

  return { ok: true, data: { token, prefix } };
}

/** Revoga todos os tokens da conta: nenhum agente acessa o MCP até uma chave nova ser gerada. */
export async function revokeAllTokens(): Promise<ActionResult<{ revoked: number }>> {
  const user = await getCurrentUser();

  const revoked = await revokeAllAgentTokens(user.id);
  if (revoked > 0) await logActivity({ action: "token.revoked_all", actorId: user.id, metadata: { revoked } });

  return { ok: true, data: { revoked } };
}
