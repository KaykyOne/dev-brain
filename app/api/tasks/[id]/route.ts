import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateTaskRequest, jsonError, readJson } from "@/lib/tasks/auth";
import { deleteTask, editTask, getTask, reportProgress, runTaskCommand } from "@/lib/tasks/service";
import { editTaskSchema, taskCommandSchema, taskProgressSchema } from "@/lib/validations/task";

const idSchema = z.uuid();

async function resolveId(ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  return idSchema.safeParse(id).success ? id : null;
}

export async function GET(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const auth = await authenticateTaskRequest(request);
  if (!auth.ok) return auth.response;
  const id = await resolveId(ctx);
  if (!id) return jsonError(404, "Tarefa não encontrada");

  const task = await getTask(auth.caller.ownerId, id);
  return task ? NextResponse.json({ task }) : jsonError(404, "Tarefa não encontrada");
}

/** Progresso do executor: sinal de vida, log e resultado final. A resposta diz se o usuário pediu para cancelar. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const auth = await authenticateTaskRequest(request);
  if (!auth.ok) return auth.response;
  const id = await resolveId(ctx);
  if (!id) return jsonError(404, "Tarefa não encontrada");

  const parsed = taskProgressSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(400, "Dados inválidos");

  const result = await reportProgress(auth.caller.ownerId, id, parsed.data);
  return result ? NextResponse.json(result) : jsonError(409, "A tarefa não está em execução por este executor");
}

/** Comandos do usuário: cancel, retry, up, down. */
export async function POST(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const auth = await authenticateTaskRequest(request);
  if (!auth.ok) return auth.response;
  const id = await resolveId(ctx);
  if (!id) return jsonError(404, "Tarefa não encontrada");

  const parsed = taskCommandSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(400, "Comando inválido");

  const result = await runTaskCommand(auth.caller.ownerId, id, parsed.data.command);
  return result.ok ? NextResponse.json({ ok: true }) : jsonError(400, result.error);
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const auth = await authenticateTaskRequest(request);
  if (!auth.ok) return auth.response;
  const id = await resolveId(ctx);
  if (!id) return jsonError(404, "Tarefa não encontrada");

  const result = await deleteTask(auth.caller.ownerId, id);
  return result.ok ? NextResponse.json({ ok: true }) : jsonError(400, result.error);
}

/** Edição de uma tarefa com erro/cancelada. Salvar não a coloca na fila. */
export async function PUT(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const auth = await authenticateTaskRequest(request);
  if (!auth.ok) return auth.response;
  const id = await resolveId(ctx);
  if (!id) return jsonError(404, "Tarefa não encontrada");
  const parsed = editTaskSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", fieldErrors: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
  }
  const result = await editTask(auth.caller.ownerId, id, parsed.data);
  return result.ok ? NextResponse.json({ ok: true }) : jsonError(400, result.error);
}
