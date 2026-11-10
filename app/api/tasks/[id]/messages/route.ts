import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateTaskRequest, jsonError, readJson } from "@/lib/tasks/auth";
import { addFollowUp } from "@/lib/tasks/service";
import { taskMessageSchema } from "@/lib/validations/task";

/** Continua a conversa com o agente: a tarefa volta à fila na máquina que tem a sessão. */
export async function POST(request: Request, ctx: RouteContext<"/api/tasks/[id]/messages">) {
  const auth = await authenticateTaskRequest(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return jsonError(404, "Tarefa não encontrada");

  const parsed = taskMessageSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", fieldErrors: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
  }

  const result = await addFollowUp(auth.caller.ownerId, id, parsed.data);
  return result.ok ? NextResponse.json({ ok: true }) : jsonError(400, result.error);
}
