import "server-only";

import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/db";
import { agentTokens } from "@/db/schema";

/** Estado do acesso ao MCP: a chave de conta vigente (se houver) e quantos tokens ainda estão ativos. */
export async function getAccessKeyStatus(ownerId: string) {
  const active = and(eq(agentTokens.ownerId, ownerId), isNull(agentTokens.revokedAt));

  const [[key], [{ activeCount }], [{ legacyCount }]] = await Promise.all([
    db
      .select({
        prefix: agentTokens.tokenPrefix,
        createdAt: agentTokens.createdAt,
        lastUsedAt: agentTokens.lastUsedAt,
        expiresAt: agentTokens.expiresAt,
      })
      .from(agentTokens)
      .where(and(active, isNull(agentTokens.projectId)))
      .orderBy(desc(agentTokens.createdAt))
      .limit(1),
    db.select({ activeCount: count() }).from(agentTokens).where(active),
    db.select({ legacyCount: count() }).from(agentTokens).where(and(active, isNotNull(agentTokens.projectId))),
  ]);

  return { key: key ?? null, activeCount, legacyCount };
}
