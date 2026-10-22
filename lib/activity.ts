import "server-only";

import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { logger } from "@/lib/logger";

export const ACTIVITY_LABELS = {
  "project.created": "Projeto criado",
  "project.updated": "Projeto atualizado",
  "project.deleted": "Projeto removido",
  "project.activated": "Projeto ativado",
  "project.deactivated": "Projeto desativado",
  "skill.created": "Skill criada",
  "skill.updated": "Skill atualizada",
  "skill.deleted": "Skill removida",
  "skill.promoted": "Skill promovida",
  "skill.linked": "Skills da biblioteca aplicadas a projetos",
  "skill.unlinked": "Skill da biblioteca removida do projeto",
  "token.created": "Token MCP criado",
  "token.revoked": "Token MCP revogado",
  "context.written": "Arquivo de contexto gravado por agente",
  "proposal.created": "Proposta de alteração recebida",
  "proposal.approved": "Proposta de alteração aprovada",
  "proposal.rejected": "Proposta de alteração recusada",
  "auth.login": "Login realizado",
  "auth.logout": "Logout realizado",
  "auth.password_changed": "Senha alterada",
} as const;

export type ActivityAction = keyof typeof ACTIVITY_LABELS;

/** Grava a ação no histórico e também na página Logs (app_logs), com o escopo derivado do prefixo da ação. */
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

  await logger.info(entry.action.split(".")[0], ACTIVITY_LABELS[entry.action], {
    details: { acao: entry.action, ator: entry.actorId ?? undefined, projeto: entry.projectId ?? undefined, ...entry.metadata },
  });
}
