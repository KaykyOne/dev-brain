import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { agentTokens } from "@/db/schema";

import { generateToken } from "./token";
import { encryptSecret } from "@/lib/security/app-secret";

export const ACCESS_KEY_NAME = "Chave de acesso";

/** Revoga todos os tokens ainda ativos da conta (inclusive os de projeto do modelo antigo). Devolve quantos. */
export async function revokeAllAgentTokens(ownerId: string) {
  const revoked = await db
    .update(agentTokens)
    .set({ revokedAt: new Date(), tokenCiphertext: null })
    .where(and(eq(agentTokens.ownerId, ownerId), isNull(agentTokens.revokedAt)))
    .returning({ id: agentTokens.id });
  return revoked.length;
}

/**
 * Emite a chave de acesso do MCP: uma só por conta, então as anteriores são revogadas.
 * Guarda o hash (autenticação) e o token cifrado (para o painel exibi-lo de novo).
 */
export async function issueAccessKey(ownerId: string) {
  const { token, hash, prefix } = generateToken();
  const tokenCiphertext = await encryptSecret(token);

  return db.transaction(async (tx) => {
    await tx
      .update(agentTokens)
      .set({ revokedAt: new Date(), tokenCiphertext: null })
      .where(and(eq(agentTokens.ownerId, ownerId), isNull(agentTokens.revokedAt)));

    const [created] = await tx
      .insert(agentTokens)
      .values({ ownerId, projectId: null, name: ACCESS_KEY_NAME, scopes: [], tokenHash: hash, tokenPrefix: prefix, tokenCiphertext })
      .returning({ id: agentTokens.id, createdAt: agentTokens.createdAt });

    return { id: created.id, token, prefix, createdAt: created.createdAt };
  });
}
