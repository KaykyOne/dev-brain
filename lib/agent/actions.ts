"use server";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { agentTokens, projects } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { fail, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/dal";
import { ACCOUNT_TARGET, agentTokenSchema } from "@/lib/validations/agent-token";

import { issueAgentToken } from "./issue";

/** Resultado da criação: o token em claro (exibido uma única vez) e, se for de projeto, qual projeto. */
export type CreatedToken = {
  token: string;
  prefix: string;
  name: string;
  project: { name: string; slug: string } | null;
};

export async function createAgentToken(
  input: unknown,
): Promise<ActionResult<CreatedToken>> {
  const user = await getCurrentUser();

  const parsed = agentTokenSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos", z.flattenError(parsed.error).fieldErrors);

  const { name, projectId, scopes, expiration } = parsed.data;

  const accountToken = projectId === ACCOUNT_TARGET;

  let project: CreatedToken["project"] = null;
  if (!accountToken) {
    const [found] = await db
      .select({ name: projects.name, slug: projects.slug })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, user.id)))
      .limit(1);
    if (!found) return fail("Projeto não encontrado");
    project = found;
  }

  const { id, token, prefix } = await issueAgentToken({
    ownerId: user.id,
    projectId: accountToken ? null : projectId,
    name,
    scopes,
    expiresInDays: expiration === "never" ? null : Number(expiration),
  });

  await logActivity({
    action: "token.created",
    actorId: user.id,
    projectId: accountToken ? null : projectId,
    metadata: { name, tokenId: id, scope: accountToken ? "account" : "project" },
  });

  return { ok: true, data: { token, prefix, name, project } };
}

export async function revokeAgentToken(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();

  const [token] = await db
    .update(agentTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(agentTokens.id, id), isNull(agentTokens.revokedAt), eq(agentTokens.ownerId, user.id)))
    .returning({ name: agentTokens.name, projectId: agentTokens.projectId });

  if (!token) return fail("Token não encontrado");

  await logActivity({
    action: "token.revoked",
    actorId: user.id,
    projectId: token.projectId,
    metadata: { name: token.name },
  });

  return { ok: true, data: undefined };
}
