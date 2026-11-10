import "server-only";

import { and, asc, desc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { agentTaskAttachments, agentTaskMessages, agentTasks, projects, type AgentTask } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { fail, type ActionResult } from "@/lib/action-result";
import { notify } from "@/lib/notifications";
import type { CreateTaskValues, EditTaskValues, TaskCommand, TaskProgress } from "@/lib/validations/task";

/** Sem sinal de vida do executor por este tempo, a tarefa em execução é dada como falha. */
const STALE_AFTER_MS = 2 * 60_000;

export type AttachmentInfo = { id: string; name: string; mimeType: string; size: number };

/** Formato público (API e painel). Datas em ISO para atravessar JSON e a fronteira servidor/cliente. */
export type TaskView = {
  id: string;
  project: string;
  projectName: string;
  title: string;
  prompt: string;
  agent: AgentTask["agent"];
  branchMode: AgentTask["branchMode"];
  branch: string | null;
  baseBranch: string | null;
  status: AgentTask["status"];
  position: number;
  source: string;
  runner: string | null;
  resultBranch: string | null;
  summary: string | null;
  error: string | null;
  committed: boolean;
  cancelRequested: boolean;
  createdAt: string;
  startedAt: string | null;
  heartbeatAt: string | null;
  finishedAt: string | null;
  attachments: AttachmentInfo[];
  planModel: string | null;
  execModel: string | null;
  planFirst: boolean;
  /** Há sessão do agente: dá para continuar a conversa (na máquina `runner`). */
  hasSession: boolean;
  /** Na fila como continuação de uma conversa (só a máquina `runner` pode executar). */
  isFollowUp: boolean;
  // Só no detalhe (getTask, claim):
  logTail?: string | null;
  plan?: string | null;
  sessionId?: string | null;
  messages?: TaskMessageView[];
};

export type TaskMessageView = { id: string; role: "user" | "agent" | "plan"; content: string; model: string | null; createdAt: string };

type NewAttachment = { name: string; mimeType: string; content: Buffer };

const iso = (date: Date | null) => (date ? date.toISOString() : null);

function toView(
  row: AgentTask,
  project: { slug: string; name: string },
  attachments: AttachmentInfo[],
  withLog = false,
): TaskView {
  return {
    id: row.id,
    project: project.slug,
    projectName: project.name,
    title: row.title,
    prompt: row.prompt,
    agent: row.agent,
    branchMode: row.branchMode,
    branch: row.branch,
    baseBranch: row.baseBranch,
    status: row.status,
    position: row.position,
    source: row.source,
    runner: row.runner,
    resultBranch: row.resultBranch,
    summary: row.summary,
    error: row.error,
    committed: row.committed,
    cancelRequested: !!row.cancelRequestedAt,
    createdAt: row.createdAt.toISOString(),
    startedAt: iso(row.startedAt),
    heartbeatAt: iso(row.heartbeatAt),
    finishedAt: iso(row.finishedAt),
    attachments,
    planModel: row.planModel,
    execModel: row.execModel,
    planFirst: row.planFirst,
    hasSession: !!row.sessionId,
    isFollowUp: row.status === "queued" && !!row.sessionId,
    ...(withLog ? { logTail: row.logTail, plan: row.plan, sessionId: row.sessionId } : {}),
  };
}

async function messagesFor(taskId: string): Promise<TaskMessageView[]> {
  const rows = await db
    .select()
    .from(agentTaskMessages)
    .where(eq(agentTaskMessages.taskId, taskId))
    .orderBy(asc(agentTaskMessages.createdAt));
  return rows.map((m) => ({ id: m.id, role: m.role, content: m.content, model: m.model, createdAt: m.createdAt.toISOString() }));
}

async function attachmentsFor(taskIds: string[]): Promise<Map<string, AttachmentInfo[]>> {
  const map = new Map<string, AttachmentInfo[]>();
  if (taskIds.length === 0) return map;
  const rows = await db
    .select({
      id: agentTaskAttachments.id,
      taskId: agentTaskAttachments.taskId,
      name: agentTaskAttachments.name,
      mimeType: agentTaskAttachments.mimeType,
      size: agentTaskAttachments.size,
    })
    .from(agentTaskAttachments)
    .where(inArray(agentTaskAttachments.taskId, taskIds))
    .orderBy(asc(agentTaskAttachments.createdAt));
  for (const { taskId, ...info } of rows) {
    map.set(taskId, [...(map.get(taskId) ?? []), info]);
  }
  return map;
}

/** Marca como falha as tarefas cujo executor sumiu (VS Code fechado, máquina desligada) e avisa no sino. */
export async function reapStaleTasks(ownerId: string) {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  const reaped = await db
    .update(agentTasks)
    .set({
      status: sql`case when ${agentTasks.cancelRequestedAt} is not null then 'cancelled'::task_status else 'failed'::task_status end`,
      error: "O executor parou de responder (VS Code fechado ou máquina desligada).",
      finishedAt: new Date(),
    })
    .where(and(eq(agentTasks.ownerId, ownerId), eq(agentTasks.status, "running"), lt(agentTasks.heartbeatAt, cutoff)))
    .returning({ id: agentTasks.id, projectId: agentTasks.projectId, title: agentTasks.title, status: agentTasks.status, runner: agentTasks.runner });

  for (const task of reaped.filter((t) => t.status === "failed")) {
    await notify({
      ownerId,
      projectId: task.projectId,
      kind: "task.failed",
      title: `Tarefa falhou: ${task.title}`,
      body: `O executor${task.runner ? ` (${task.runner})` : ""} parou de responder.`,
      href: `/tasks?task=${task.id}`,
    });
  }
}

export async function listTasks(
  ownerId: string,
  { projects: slugs, limit = 200 }: { projects?: string[]; limit?: number } = {},
): Promise<TaskView[]> {
  await reapStaleTasks(ownerId);

  const rows = await db
    .select({ task: agentTasks, project: { slug: projects.slug, name: projects.name } })
    .from(agentTasks)
    .innerJoin(projects, eq(projects.id, agentTasks.projectId))
    .where(and(eq(agentTasks.ownerId, ownerId), slugs?.length ? inArray(projects.slug, slugs) : undefined))
    // Fila e execução primeiro (na ordem da fila); depois as finalizadas, das mais recentes.
    .orderBy(
      sql`case ${agentTasks.status} when 'running' then 0 when 'queued' then 1 else 2 end`,
      asc(sql`case when ${agentTasks.status} in ('running', 'queued') then ${agentTasks.position} end`),
      desc(sql`coalesce(${agentTasks.finishedAt}, ${agentTasks.createdAt})`),
    )
    .limit(limit);

  const attachments = await attachmentsFor(rows.map((r) => r.task.id));
  return rows.map((r) => toView(r.task, r.project, attachments.get(r.task.id) ?? []));
}

export async function getTask(ownerId: string, id: string): Promise<TaskView | null> {
  const [row] = await db
    .select({ task: agentTasks, project: { slug: projects.slug, name: projects.name } })
    .from(agentTasks)
    .innerJoin(projects, eq(projects.id, agentTasks.projectId))
    .where(and(eq(agentTasks.id, id), eq(agentTasks.ownerId, ownerId)))
    .limit(1);
  if (!row) return null;
  const [attachments, messages] = await Promise.all([attachmentsFor([id]), messagesFor(id)]);
  return { ...toView(row.task, row.project, attachments.get(id) ?? [], true), messages };
}

export async function createTask({
  ownerId,
  values,
  attachments,
  source,
}: {
  ownerId: string;
  values: CreateTaskValues;
  attachments: NewAttachment[];
  source: string;
}): Promise<ActionResult<TaskView>> {
  const [project] = await db
    .select({ id: projects.id, slug: projects.slug, name: projects.name, active: projects.active })
    .from(projects)
    .where(and(eq(projects.ownerId, ownerId), eq(projects.slug, values.project)))
    .limit(1);

  if (!project) return fail("Dados inválidos", { project: ["Projeto não encontrado"] });
  if (!project.active) return fail("Dados inválidos", { project: ["Projeto desativado: reative-o para cadastrar tarefas"] });

  const task = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(agentTasks)
      .values({
        ownerId,
        projectId: project.id,
        title: values.title,
        prompt: values.prompt,
        agent: values.agent,
        branchMode: values.branchMode,
        branch: values.branch || null,
        baseBranch: values.branchMode === "new" ? values.baseBranch || null : null,
        planModel: values.planModel || null,
        execModel: values.execModel || null,
        planFirst: values.planFirst,
        position: Date.now(),
        source,
      })
      .returning();

    const saved = attachments.length
      ? await tx
          .insert(agentTaskAttachments)
          .values(attachments.map((file) => ({ taskId: row.id, name: file.name, mimeType: file.mimeType, size: file.content.length, content: file.content })))
          .returning({
            id: agentTaskAttachments.id,
            name: agentTaskAttachments.name,
            mimeType: agentTaskAttachments.mimeType,
            size: agentTaskAttachments.size,
          })
      : [];

    return toView(row, project, saved);
  });

  await logActivity({
    action: "task.created",
    actorId: ownerId,
    projectId: project.id,
    metadata: { title: values.title, agent: values.agent, source },
  });

  return { ok: true, data: task };
}

/**
 * Reivindica a próxima tarefa da fila dos projetos informados, de forma atômica (duas máquinas nunca pegam a mesma).
 * Não libera uma tarefa cuja branch já está em execução no mesmo projeto.
 */
export async function claimNextTask(ownerId: string, slugs: string[], runner: string): Promise<TaskView | null> {
  await reapStaleTasks(ownerId);

  const claimed = await db.transaction(async (tx) => {
    const [next] = await tx
      .select({ id: agentTasks.id })
      .from(agentTasks)
      .innerJoin(projects, eq(projects.id, agentTasks.projectId))
      .where(
        and(
          eq(agentTasks.ownerId, ownerId),
          eq(agentTasks.status, "queued"),
          inArray(projects.slug, slugs),
          eq(projects.active, true),
          // Continuação de conversa: a sessão do agente só existe na máquina que executou.
          sql`(${agentTasks.sessionId} is null or ${agentTasks.runner} = ${runner})`,
          sql`not exists (
            select 1 from agent_tasks r
            where r.project_id = ${agentTasks.projectId}
              and r.status = 'running'
              and ${agentTasks.branch} is not null
              and coalesce(r.result_branch, r.branch) = ${agentTasks.branch}
          )`,
        ),
      )
      .orderBy(asc(agentTasks.position))
      .limit(1)
      .for("update", { of: agentTasks, skipLocked: true });

    if (!next) return null;

    const now = new Date();
    const [row] = await tx
      .update(agentTasks)
      .set({
        status: "running",
        runner,
        startedAt: now,
        heartbeatAt: now,
        finishedAt: null,
        error: null,
        summary: null,
        logTail: null,
        cancelRequestedAt: null,
      })
      .where(eq(agentTasks.id, next.id))
      .returning();
    return row;
  });

  if (!claimed) return null;
  return getTask(ownerId, claimed.id);
}

/**
 * Progresso enviado pelo executor que reivindicou a tarefa. Retorna se o usuário pediu para cancelar,
 * ou null se a tarefa não está (mais) em execução por este executor.
 */
export async function reportProgress(
  ownerId: string,
  id: string,
  progress: TaskProgress,
): Promise<{ cancelRequested: boolean } | null> {
  const final = progress.status !== "running";
  const now = new Date();

  const row = await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ plan: agentTasks.plan })
      .from(agentTasks)
      .where(and(eq(agentTasks.id, id), eq(agentTasks.ownerId, ownerId), eq(agentTasks.runner, progress.runner), eq(agentTasks.status, "running")))
      .limit(1)
      .for("update");
    if (!before) return null;

    const [row] = await tx
      .update(agentTasks)
      .set({
        heartbeatAt: now,
        ...(progress.resultBranch ? { resultBranch: progress.resultBranch } : {}),
        ...(progress.logTail !== undefined ? { logTail: progress.logTail } : {}),
        ...(progress.committed !== undefined ? { committed: progress.committed } : {}),
        ...(progress.sessionId ? { sessionId: progress.sessionId } : {}),
        ...(progress.plan ? { plan: progress.plan } : {}),
        ...(final
          ? {
              status: progress.status,
              finishedAt: now,
              summary: progress.summary ?? null,
              error: progress.status === "done" ? null : progress.error ?? null,
            }
          : {}),
      })
      .where(
        and(
          eq(agentTasks.id, id),
          eq(agentTasks.ownerId, ownerId),
          eq(agentTasks.runner, progress.runner),
          eq(agentTasks.status, "running"),
        ),
      )
      .returning();

    if (!row) return null;

    // Conversa: o plano (uma vez) e a resposta do agente ao fim de cada execução.
    if (progress.plan && progress.plan !== before?.plan) {
      await tx.insert(agentTaskMessages).values({ taskId: id, role: "plan", content: progress.plan, model: row.planModel, createdAt: now });
    }
    if (final) {
      const content =
        row.status === "done"
          ? row.summary || "Concluído."
          : row.status === "cancelled"
            ? "Execução cancelada."
            : `Falhou: ${row.error ?? "erro desconhecido"}`;
      const [lastUser] = await tx.select({ model: agentTaskMessages.model }).from(agentTaskMessages)
        .where(and(eq(agentTaskMessages.taskId, id), eq(agentTaskMessages.role, "user")))
        .orderBy(desc(agentTaskMessages.createdAt)).limit(1);
      await tx.insert(agentTaskMessages).values({ taskId: id, role: "agent", content,
        model: lastUser?.model || row.execModel, createdAt: new Date(now.getTime() + 1) });
    }

    return row;
  });
  if (!row) return null;

  if (final && row.status !== "cancelled") {
    const ok = row.status === "done";
    await notify({
      ownerId,
      projectId: row.projectId,
      kind: ok ? "task.done" : "task.failed",
      title: ok ? `Tarefa concluída: ${row.title}` : `Tarefa falhou: ${row.title}`,
      body: (ok ? row.summary : row.error)?.slice(0, 300) ?? "",
      href: `/tasks?task=${row.id}`,
    });
  }

  return { cancelRequested: !!row.cancelRequestedAt };
}

export async function runTaskCommand(ownerId: string, id: string, command: TaskCommand): Promise<ActionResult> {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select()
      .from(agentTasks)
      .where(and(eq(agentTasks.id, id), eq(agentTasks.ownerId, ownerId)))
      .limit(1)
      .for("update");
    if (!task) return fail("Tarefa não encontrada");

    if (command === "cancel") {
      if (task.status === "queued") {
        await tx.update(agentTasks).set({ status: "cancelled", finishedAt: new Date() }).where(eq(agentTasks.id, id));
      } else if (task.status === "running") {
        // O executor vê o pedido no próximo sinal de vida e interrompe o agente.
        await tx.update(agentTasks).set({ cancelRequestedAt: new Date() }).where(eq(agentTasks.id, id));
      } else {
        return fail("A tarefa já terminou");
      }
      return { ok: true, data: undefined };
    }

    if (command === "retry") {
      if (task.status === "queued" || task.status === "running") return fail("A tarefa ainda está na fila ou em execução");
      const continueOn = task.resultBranch;
      await tx
        .update(agentTasks)
        .set({
          status: "queued",
          position: Date.now(),
          runner: null,
          summary: null,
          error: null,
          logTail: null,
          committed: false,
          startedAt: null,
          heartbeatAt: null,
          finishedAt: null,
          cancelRequestedAt: null,
          // Rodar de novo começa uma conversa nova.
          sessionId: null,
          plan: null,
          // Continua na branch em que o trabalho ficou.
          ...(continueOn ? { branchMode: "existing" as const, branch: continueOn } : {}),
        })
        .where(eq(agentTasks.id, id));
      await tx.delete(agentTaskMessages).where(eq(agentTaskMessages.taskId, id));
      return { ok: true, data: undefined };
    }

    // up / down: troca de posição com a vizinha na fila do mesmo projeto.
    if (task.status !== "queued") return fail("Só tarefas na fila podem mudar de posição");
    const up = command === "up";
    const [neighbor] = await tx
      .select({ id: agentTasks.id, position: agentTasks.position })
      .from(agentTasks)
      .where(
        and(
          eq(agentTasks.ownerId, ownerId),
          eq(agentTasks.projectId, task.projectId),
          eq(agentTasks.status, "queued"),
          ne(agentTasks.id, id),
          up ? lt(agentTasks.position, task.position) : gt(agentTasks.position, task.position),
        ),
      )
      .orderBy(up ? desc(agentTasks.position) : asc(agentTasks.position))
      .limit(1);
    if (!neighbor) return { ok: true, data: undefined };

    await tx.transaction(async (tx) => {
      await tx.update(agentTasks).set({ position: neighbor.position }).where(eq(agentTasks.id, id));
      await tx.update(agentTasks).set({ position: task.position }).where(eq(agentTasks.id, neighbor.id));
    });
    return { ok: true, data: undefined };
  });
}
/**
 * Continua a conversa: guarda a mensagem e devolve a tarefa à fila. Só a máquina que tem a sessão do agente
 * (`runner`) pode pegá-la, e ela retoma a mesma sessão, na mesma branch.
 */
export async function addFollowUp(
  ownerId: string,
  id: string,
  { content, model }: { content: string; model: string },
): Promise<ActionResult> {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select({ status: agentTasks.status, sessionId: agentTasks.sessionId, resultBranch: agentTasks.resultBranch })
      .from(agentTasks)
      .where(and(eq(agentTasks.id, id), eq(agentTasks.ownerId, ownerId)))
      .limit(1)
      .for("update");
    if (!task) return fail("Tarefa não encontrada");
    if (task.status === "queued" || task.status === "running") return fail("Aguarde a execução atual terminar");
    if (!task.sessionId) return fail("Esta execução não deixou sessão para continuar. Use Rodar de novo.");

    await tx.insert(agentTaskMessages).values({ taskId: id, role: "user", content, model: model || null });
    await tx.update(agentTasks).set({
      status: "queued",
      position: Date.now(),
      summary: null,
      error: null,
      logTail: null,
      startedAt: null,
      heartbeatAt: null,
      finishedAt: null,
      cancelRequestedAt: null,
      ...(task.resultBranch ? { branchMode: "existing" as const, branch: task.resultBranch } : {}),
    }).where(eq(agentTasks.id, id));
    return { ok: true, data: undefined };
  });
}

/** Salva correções sem executar: exige tarefa encerrada com erro ou cancelada, sob o mesmo lock do claim. */
export async function editTask(ownerId: string, id: string, values: EditTaskValues): Promise<ActionResult> {
  return db.transaction(async (tx) => {
    const [task] = await tx.select({ status: agentTasks.status }).from(agentTasks)
      .where(and(eq(agentTasks.id, id), eq(agentTasks.ownerId, ownerId)))
      .limit(1).for("update");
    if (!task) return fail("Tarefa não encontrada");
    if (task.status !== "failed" && task.status !== "cancelled") {
      return fail("Só é possível editar tarefas com falha ou canceladas. Interrompa a execução e aguarde ela terminar.");
    }
    await tx.update(agentTasks).set({ ...values, planModel: values.planModel || null,
      execModel: values.execModel || null, plan: null, sessionId: null,
    }).where(eq(agentTasks.id, id));
    return { ok: true, data: undefined };
  });
}

export async function deleteTask(ownerId: string, id: string): Promise<ActionResult> {
  const [row] = await db
    .delete(agentTasks)
    .where(and(eq(agentTasks.id, id), eq(agentTasks.ownerId, ownerId), ne(agentTasks.status, "running")))
    .returning({ id: agentTasks.id });
  return row ? { ok: true, data: undefined } : fail("Tarefa não encontrada ou em execução");
}

/** Remove as tarefas concluídas e canceladas dos projetos informados (ou de todos). */
export async function clearFinishedTasks(ownerId: string, slugs?: string[]): Promise<number> {
  const projectFilter = slugs?.length
    ? inArray(
        agentTasks.projectId,
        db.select({ id: projects.id }).from(projects).where(and(eq(projects.ownerId, ownerId), inArray(projects.slug, slugs))),
      )
    : undefined;
  const rows = await db
    .delete(agentTasks)
    .where(and(eq(agentTasks.ownerId, ownerId), inArray(agentTasks.status, ["done", "cancelled"]), projectFilter))
    .returning({ id: agentTasks.id });
  return rows.length;
}

export async function getAttachment(ownerId: string, taskId: string, attachmentId: string) {
  const [row] = await db
    .select({
      name: agentTaskAttachments.name,
      mimeType: agentTaskAttachments.mimeType,
      content: agentTaskAttachments.content,
    })
    .from(agentTaskAttachments)
    .innerJoin(agentTasks, eq(agentTasks.id, agentTaskAttachments.taskId))
    .where(
      and(
        eq(agentTaskAttachments.id, attachmentId),
        eq(agentTaskAttachments.taskId, taskId),
        eq(agentTasks.ownerId, ownerId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Projetos da conta, para o seletor do painel. */
export async function listTaskProjects(ownerId: string) {
  return db
    .select({ slug: projects.slug, name: projects.name, defaultBranch: projects.defaultBranch, active: projects.active })
    .from(projects)
    .where(eq(projects.ownerId, ownerId))
    .orderBy(asc(projects.name));
}

export const hasActiveTasks = (tasks: TaskView[]) => tasks.some((t) => t.status === "running" || t.status === "queued");

