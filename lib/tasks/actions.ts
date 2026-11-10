"use server";

import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/dal";
import { editTaskSchema, taskCommandSchema, taskMessageSchema } from "@/lib/validations/task";

import { addFollowUp, clearFinishedTasks, deleteTask, editTask, runTaskCommand } from "./service";

const idSchema = z.uuid();

export async function taskCommand(id: string, command: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = taskCommandSchema.shape.command.safeParse(command);
  if (!idSchema.safeParse(id).success || !parsed.success) return fail("Comando inválido");
  return runTaskCommand(user.id, id, parsed.data);
}

export async function removeTask(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!idSchema.safeParse(id).success) return fail("Tarefa não encontrada");
  return deleteTask(user.id, id);
}

export async function clearFinished(project?: string): Promise<ActionResult<{ removed: number }>> {
  const user = await getCurrentUser();
  const removed = await clearFinishedTasks(user.id, project ? [project] : undefined);
  return { ok: true, data: { removed } };
}

export async function sendTaskMessage(id: string, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!idSchema.safeParse(id).success) return fail("Tarefa não encontrada");
  const parsed = taskMessageSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Mensagem inválida");
  return addFollowUp(user.id, id, parsed.data);
}

export async function saveTaskEdits(id: string, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!idSchema.safeParse(id).success) return fail("Tarefa não encontrada");
  const parsed = editTaskSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");
  return editTask(user.id, id, parsed.data);
}
