"use client";

import { ArrowDownIcon, ArrowUpIcon, ListChecksIcon, PaperclipIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { taskCommand } from "@/lib/tasks/actions";
import type { TaskView } from "@/lib/tasks/service";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { TaskProject } from "./new-task-dialog";
import { AgentBadge, BranchBadge, formatDuration, STATUS_META, STATUS_ORDER, StatusIcon } from "./task-meta";
import { TaskSheet } from "./task-sheet";

const ALL = "__all__";

/** Filtros de status. Nada selecionado mostra tudo; clicar no filtro ativo o desmarca. */
const FILTERS = [
  { key: "queued", label: "Pendentes", hint: "Na fila", statuses: ["queued"] },
  { key: "running", label: "Ativas", hint: "Em execução", statuses: ["running"] },
  { key: "finished", label: "Concluídas", hint: "Terminadas, inclusive com falha e canceladas", statuses: ["done", "failed", "cancelled"] },
] as const satisfies readonly { key: string; label: string; hint: string; statuses: readonly TaskView["status"][] }[];

type FilterKey = (typeof FILTERS)[number]["key"];

/** Relógio que avança a cada segundo, para o tempo das tarefas em execução. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function timeText(task: TaskView, now: number) {
  if (task.status === "running" && task.startedAt) return formatDuration(now - Date.parse(task.startedAt));
  if (task.status === "queued") return formatRelative(task.createdAt, new Date(now));
  if (task.startedAt && task.finishedAt) return formatDuration(Date.parse(task.finishedAt) - Date.parse(task.startedAt));
  return task.finishedAt ? formatRelative(task.finishedAt, new Date(now)) : "";
}

export function TaskBoard({
  tasks,
  projects,
  project,
  selectedId,
}: {
  tasks: TaskView[];
  projects: TaskProject[];
  project?: string;
  selectedId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const filterParam = searchParams.get("status");
  const filter = FILTERS.find((f) => f.key === filterParam)?.key as FilterKey | undefined;

  const active = tasks.some((t) => t.status === "running" || t.status === "queued");
  const now = useNow(tasks.some((t) => t.status === "running"));

  // Atualiza a lista sozinho: rápido enquanto há tarefas na fila ou em execução.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), active ? 4000 : 20000);
    return () => clearInterval(id);
  }, [active, router]);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function command(id: string, cmd: "up" | "down") {
    startTransition(async () => {
      const result = await taskCommand(id, cmd);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  const projectItems = { [ALL]: "Todos os projetos", ...Object.fromEntries(projects.map((p) => [p.slug, p.name])) };
  const selected = tasks.find((t) => t.id === selectedId);
  const multiProject = !project && new Set(tasks.map((t) => t.project)).size > 1;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select items={projectItems} value={project ?? ALL} onValueChange={(value) => setParam("project", value && value !== ALL ? value : null)}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os projetos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.slug} value={p.slug}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListChecksIcon}
          title="Nenhuma tarefa"
          description="Cadastre uma tarefa aqui ou pela extensão Agent Tasks do VS Code. O Claude Code ou o Codex executa numa branch própria e você é avisado ao terminar."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3" role="group" aria-label="Filtrar tarefas">
            {FILTERS.map((f) => {
              const inGroup = tasks.filter((t) => (f.statuses as readonly string[]).includes(t.status));
              const failed = f.key === "finished" ? tasks.filter((t) => t.status === "failed").length : 0;
              const pressed = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={pressed}
                  title={f.hint}
                  onClick={() => setParam("status", pressed ? null : f.key)}
                  className={cn(
                    "rounded-xl bg-card px-4 py-3 text-left ring-1 ring-foreground/10 transition outline-none hover:ring-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50",
                    pressed && "bg-muted ring-2 ring-foreground/40",
                  )}
                >
                  <div className={cn("flex items-center gap-2 text-2xl font-semibold tabular-nums", f.key === "running" && "text-[var(--series-1)]")}>
                    {inGroup.length}
                    {failed > 0 && <span className="size-2 rounded-full bg-destructive" title={`${failed} com falha`} aria-label={`${failed} com falha`} />}
                  </div>
                  <div className="text-xs text-muted-foreground">{f.label.toLowerCase()}</div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-6">
            {filter && !tasks.some((t) => (FILTERS.find((f) => f.key === filter)!.statuses as readonly string[]).includes(t.status)) && (
              <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma tarefa em &ldquo;{FILTERS.find((f) => f.key === filter)!.label.toLowerCase()}&rdquo;.{" "}
                <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => setParam("status", null)}>
                  Ver todas
                </button>
              </p>
            )}
            {STATUS_ORDER.filter((status) => !filter || (FILTERS.find((f) => f.key === filter)!.statuses as readonly string[]).includes(status)).map((status) => {
              const list = tasks.filter((t) => t.status === status);
              if (list.length === 0) return null;
              const isCollapsed = collapsed.has(status);
              return (
                <section key={status} className="grid gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
                    aria-expanded={!isCollapsed}
                    onClick={() =>
                      setCollapsed((prev) => {
                        const next = new Set(prev);
                        if (next.has(status)) next.delete(status);
                        else next.add(status);
                        return next;
                      })
                    }
                  >
                    {STATUS_META[status].section}
                    <span className="tabular-nums">({list.length})</span>
                  </button>
                  {!isCollapsed && (
                    <ul className="grid gap-2">
                      {list.map((task, index) => (
                        <li key={task.id}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setParam("task", task.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setParam("task", task.id);
                              }
                            }}
                            className={cn(
                              "group grid cursor-pointer gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 transition outline-none hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50",
                              task.status === "running" && "ring-[var(--series-1)]/50",
                            )}
                          >
                            <div className="flex items-start gap-3">
                              {task.status === "queued" ? (
                                <span className="mt-0.5 grid size-4 shrink-0 place-content-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                                  {index + 1}
                                </span>
                              ) : (
                                <StatusIcon status={task.status} className="mt-0.5" />
                              )}
                              <p className="min-w-0 flex-1 font-medium leading-snug">{task.title}</p>
                              <span className="shrink-0 text-xs text-muted-foreground tabular-nums" suppressHydrationWarning>
                                {timeText(task, now)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 pl-7">
                              <AgentBadge agent={task.agent} />
                              <BranchBadge task={task} />
                              {multiProject && <Badge variant="outline">{task.projectName}</Badge>}
                              {task.attachments.length > 0 && (
                                <Badge variant="outline">
                                  <PaperclipIcon />
                                  {task.attachments.length}
                                </Badge>
                              )}
                              {task.runner && task.status === "running" && (
                                <span className="text-xs text-muted-foreground">em {task.runner}</span>
                              )}
                              {task.isFollowUp && <Badge variant="secondary">continuação</Badge>}
                              {task.planFirst && task.status === "queued" && !task.isFollowUp && (
                                <Badge variant="outline">planejar antes</Badge>
                              )}
                              {task.cancelRequested && task.status === "running" && (
                                <Badge variant="destructive">cancelando…</Badge>
                              )}
                              {task.status === "queued" && (
                                <span className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label="Subir na fila"
                                    disabled={pending || index === 0}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      command(task.id, "up");
                                    }}
                                  >
                                    <ArrowUpIcon />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label="Descer na fila"
                                    disabled={pending || index === list.length - 1}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      command(task.id, "down");
                                    }}
                                  >
                                    <ArrowDownIcon />
                                  </Button>
                                </span>
                              )}
                            </div>
                            {(task.status === "failed" ? task.error : task.summary) && (
                              <p
                                className={cn(
                                  "line-clamp-2 pl-7 text-sm text-muted-foreground",
                                  task.status === "failed" && "text-destructive",
                                )}
                              >
                                {task.status === "failed" ? task.error : task.summary}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      <TaskSheet
        taskId={selectedId}
        initial={selected}
        onOpenChange={(open) => !open && setParam("task", null)}
      />
    </>
  );
}
