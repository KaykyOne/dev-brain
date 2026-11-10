import "server-only";

import { NextResponse } from "next/server";

import { authenticateAgent } from "@/lib/agent/auth";
import { validateSession } from "@/lib/auth/session";
import { env } from "@/lib/env";

export type TaskCaller = { ownerId: string; source: string };

const problem = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * As rotas de tarefas atendem dois clientes:
 * - a extensão do VS Code, com a chave de acesso da conta (`Authorization: Bearer dvb_...`, a mesma do MCP);
 * - o painel, com o cookie de sessão. Nesse caso, escrita só da mesma origem (proteção contra CSRF).
 */
export async function authenticateTaskRequest(
  request: Request,
): Promise<{ ok: true; caller: TaskCaller } | { ok: false; response: Response }> {
  if (request.headers.has("authorization")) {
    const auth = await authenticateAgent(request);
    if (!auth.ok) return auth;
    return { ok: true, caller: { ownerId: auth.context.ownerId, source: `vscode:${auth.context.tokenName}` } };
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(env.APP_URL).origin) {
      return { ok: false, response: problem(403, "Origem não permitida") };
    }
  }

  const user = await validateSession();
  if (!user) return { ok: false, response: problem(401, "Não autenticado") };
  return { ok: true, caller: { ownerId: user.id, source: "web" } };
}

export const jsonError = problem;

/** Lê o corpo JSON; `null` se não for JSON válido. */
export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
