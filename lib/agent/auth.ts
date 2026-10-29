import "server-only";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { agentTokens } from "@/db/schema";
import { env } from "@/lib/env";
import { createRateLimiter } from "@/lib/security/rate-limit";

import { evaluateToken, hashToken, parseBearerToken } from "./token";

/** Quem chama o MCP. O projeto vem de cada ferramenta (argumento `project`), não do token. */
export type AgentContext = {
  tokenId: string;
  tokenName: string;
  ownerId: string;
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
    .select({ token: agentTokens })
    .from(agentTokens)
    .where(eq(agentTokens.tokenHash, hashToken(token)))
    .limit(1);

  if (!row) return { ok: false, response: problem(401, "Token ausente ou inválido", challenge) };

  // Tokens por projeto (modelo antigo) não valem mais: o MCP é um só, com a chave de acesso da conta.
  if (row.token.projectId) {
    return {
      ok: false,
      response: problem(401, "Token de projeto descontinuado: gere a chave de acesso em /mcp", challenge),
    };
  }

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
      ownerId: row.token.ownerId,
    },
  };
}
