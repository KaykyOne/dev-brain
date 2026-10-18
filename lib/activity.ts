import "server-only";

import { db } from "@/db";
import { activityLogs } from "@/db/schema";

export const ACTIVITY_LABELS = {
  "project.created": "Projeto criado",
  "project.updated": "Projeto atualizado",
  "project.deleted": "Projeto removido",
  "skill.created": "Skill criada",
  "skill.updated": "Skill atualizada",
  "skill.deleted": "Skill removida",
  "skill.promoted": "Skill tornada universal",
  "token.created": "Token MCP criado",
  "token.revoked": "Token MCP revogado",
  "context.written": "Arquivo de contexto gravado por agente",
  "proposal.created": "Proposta de alteração recebida",
} as const;

export type ActivityAction = keyof typeof ACTIVITY_LABELS;

export async function logActivity(entry: {
  action: ActivityAction;
  actorId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(activityLogs).values({
    action: entry.action,
    actorId: entry.actorId ?? null,
    projectId: entry.projectId ?? null,
    metadata: entry.metadata ?? {},
  });
}
