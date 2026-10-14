import "server-only";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { agentTokens, projects } from "@/db/schema";
import { env } from "@/lib/env";
import { createRateLimiter } from "@/lib/security/rate-limit";

import type { AgentScope } from "./scopes";
import { evaluateToken, hashToken, parseBearerToken } from "./token";

export type AgentContext = {
  tokenId: string;
  tokenName: string;
  scopes: AgentScope[];
  project: typeof projects.$inferSelect;
};

const checkRate = createRateLimiter({ limit: 120, windowMs: 60_000 });

function problem(status: number, error: string, headers?: HeadersInit) {
  return NextResponse.json({ error }, { status, headers });
}

export async function authenticateAgent(
  request: Request,
): Promise<{ ok: true; context: AgentContext } | { ok: false; response: Response }> {
  // Navegadores enviam Origin; agentes de linha de comando não. Bloqueia chamadas cross-site.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(env.APP_URL).origin) {
    return { ok: false, response: problem(403, "Origem não permitida") };
  }

  const challenge = { "WWW-Authenticate": "Bearer" };
  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token) return { ok: false, response: problem(401, "Token ausente ou inválido", challenge) };

  const [row] = await db
    .select({ token: agentTokens, project: projects })
    .from(agentTokens)
    .innerJoin(projects, eq(projects.id, agentTokens.projectId))
    .where(eq(agentTokens.tokenHash, hashToken(token)))
    .limit(1);

  if (!row) return { ok: false, response: problem(401, "Token ausente ou inválido", challenge) };

  const state = evaluateToken(row.token, new Date());
  if (state !== "ok") {
    return {
      ok: false,
      response: problem(401, state === "revoked" ? "Token revogado" : "Token expirado", challenge),
    };
  }

  const rate = checkRate(row.token.id);
  if (!rate.allowed) {
    return {
      ok: false,
      response: problem(429, "Limite de requisições excedido", { "Retry-After": String(rate.retryAfterSeconds) }),
    };
  }

  await db.update(agentTokens).set({ lastUsedAt: new Date() }).where(eq(agentTokens.id, row.token.id));

  return {
    ok: true,
    context: {
      tokenId: row.token.id,
      tokenName: row.token.name,
      scopes: row.token.scopes as AgentScope[],
      project: row.project,
    },
  };
}
