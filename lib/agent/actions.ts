"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { agentTokens, projects } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { fail, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/dal";
import { agentTokenSchema } from "@/lib/validations/agent-token";

import { generateToken } from "./token";

export async function createAgentToken(
  input: unknown,
): Promise<ActionResult<{ token: string; prefix: string; name: string }>> {
  const user = await getCurrentUser();

  const parsed = agentTokenSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos", z.flattenError(parsed.error).fieldErrors);

  const { name, projectId, scopes, expiration } = parsed.data;

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, user.id)))
    .limit(1);
  if (!project) return fail("Projeto não encontrado");

  const { token, hash, prefix } = generateToken();
  const expiresAt =
    expiration === "never" ? null : new Date(Date.now() + Number(expiration) * 24 * 60 * 60 * 1000);

  const [created] = await db
    .insert(agentTokens)
    .values({ projectId, name, scopes, expiresAt, tokenHash: hash, tokenPrefix: prefix })
    .returning({ id: agentTokens.id });

  await logActivity({
    action: "token.created",
    actorId: user.id,
    projectId,
    metadata: { name, tokenId: created.id },
  });

  return { ok: true, data: { token, prefix, name } };
}

export async function revokeAgentToken(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();

  const [token] = await db
    .update(agentTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(agentTokens.id, id),
        isNull(agentTokens.revokedAt),
        // Só tokens de projetos do próprio usuário.
        inArray(
          agentTokens.projectId,
          db.select({ id: projects.id }).from(projects).where(eq(projects.ownerId, user.id)),
        ),
      ),
    )
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
