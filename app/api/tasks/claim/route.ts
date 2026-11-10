import { NextResponse } from "next/server";

import { authenticateTaskRequest, jsonError, readJson } from "@/lib/tasks/auth";
import { claimNextTask } from "@/lib/tasks/service";
import { claimTaskSchema } from "@/lib/validations/task";

/** O executor (extensão) pede a próxima tarefa da fila dos projetos que ele tem abertos. */
export async function POST(request: Request) {
  const auth = await authenticateTaskRequest(request);
  if (!auth.ok) return auth.response;

  const parsed = claimTaskSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(400, "Dados inválidos");

  const task = await claimNextTask(auth.caller.ownerId, parsed.data.projects, parsed.data.runner);
  return NextResponse.json({ task });
}
