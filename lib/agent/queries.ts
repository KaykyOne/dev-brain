import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { agentTokens, projects } from "@/db/schema";

export function listAgentTokens(ownerId: string) {
  return db
    .select({
      id: agentTokens.id,
      name: agentTokens.name,
      prefix: agentTokens.tokenPrefix,
      scopes: agentTokens.scopes,
      expiresAt: agentTokens.expiresAt,
      revokedAt: agentTokens.revokedAt,
      lastUsedAt: agentTokens.lastUsedAt,
      createdAt: agentTokens.createdAt,
      projectName: projects.name,
    })
    .from(agentTokens)
    .leftJoin(projects, eq(projects.id, agentTokens.projectId))
    .where(eq(agentTokens.ownerId, ownerId))
    .orderBy(desc(agentTokens.createdAt));
}
