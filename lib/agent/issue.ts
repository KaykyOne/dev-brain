import "server-only";

import { db } from "@/db";
import { agentTokens } from "@/db/schema";

import type { AgentScope } from "./scopes";
import { generateToken } from "./token";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Cria um token de agente. O valor em claro é devolvido uma única vez; só o hash é guardado. */
export async function issueAgentToken(input: {
  ownerId: string;
  projectId: string | null;
  name: string;
  scopes: AgentScope[];
  expiresInDays: number | null;
}) {
  const { token, hash, prefix } = generateToken();
  const expiresAt = input.expiresInDays === null ? null : new Date(Date.now() + input.expiresInDays * DAY_MS);

  const [created] = await db
    .insert(agentTokens)
    .values({
      ownerId: input.ownerId,
      projectId: input.projectId,
      name: input.name,
      scopes: input.scopes,
      expiresAt,
      tokenHash: hash,
      tokenPrefix: prefix,
    })
    .returning({ id: agentTokens.id });

  return { id: created.id, token, prefix, expiresAt };
}
