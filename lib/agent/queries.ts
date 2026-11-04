import "server-only";

import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/db";
import { agentTokens } from "@/db/schema";

import { decryptSecret } from "@/lib/security/app-secret";

/**
 * Estado do acesso ao MCP: a chave de conta vigente (com o valor em claro, para o painel exibi-la e preencher os
 * comandos de instalação) e quantos tokens ainda estão ativos. Só para o dono, numa página autenticada.
 */
export async function getAccessKeyStatus(ownerId: string) {
  const active = and(eq(agentTokens.ownerId, ownerId), isNull(agentTokens.revokedAt));

  const [[key], [{ activeCount }], [{ legacyCount }]] = await Promise.all([
    db
      .select({
        prefix: agentTokens.tokenPrefix,
        createdAt: agentTokens.createdAt,
        lastUsedAt: agentTokens.lastUsedAt,
        expiresAt: agentTokens.expiresAt,
        ciphertext: agentTokens.tokenCiphertext,
      })
      .from(agentTokens)
      .where(and(active, isNull(agentTokens.projectId)))
      .orderBy(desc(agentTokens.createdAt))
      .limit(1),
    db.select({ activeCount: count() }).from(agentTokens).where(active),
    db.select({ legacyCount: count() }).from(agentTokens).where(and(active, isNotNull(agentTokens.projectId))),
  ]);

  if (!key) return { key: null, activeCount, legacyCount };

  const { ciphertext, ...meta } = key;
  // Chaves geradas antes de serem cifradas não podem ser exibidas: o painel pede para gerar outra.
  const token = ciphertext ? await decryptSecret(ciphertext, "chave de acesso do MCP") : null;
  return { key: { ...meta, token }, activeCount, legacyCount };
}
