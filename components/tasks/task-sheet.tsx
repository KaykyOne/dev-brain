"use client";

import { BanIcon, DownloadIcon, FileIcon, Loader2Icon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiUrl } from "@/lib/api-url";
import { formatDateTime } from "@/lib/format";
import { removeTask, taskCommand } from "@/lib/tasks/actions";
import type { TaskView } from "@/lib/tasks/service";

import { AgentBadge, BranchBadge, formatBytes, STATUS_META, StatusIcon } from "./task-meta";
import { EditTaskDialog } from "./edit-task-dialog";
import { TaskConversation } from "./task-conversation";

const attachmentUrl = (taskId: string, attachmentId: string) =>
  apiUrl(`/api/tasks/${taskId}/attachments/${attachmentId}`);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** Detalhes da tarefa. Busca a versão completa (com o log) e atualiza enquanto ela está em execução. */
export function TaskSheet({
  taskId,
  initial,
  onOpenChange,
}: {
  taskId?: string;
  initial?: TaskView;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  // A versão completa (com log) vale enquanto for desta tarefa; antes disso, mostra a da lista.
  const [fetched, setFetched] = useState<TaskView>();
  const task = fetched?.id === taskId ? fetched : initial;
  const [pending, startTransition] = useTransition();
  const [reload, setReload] = useState(0);
  const logRef = useRef<HTMLPreElement>(null);

  const status = task?.status;
  useEffect(() => {
    if (!taskId) return;
    let stopped = false;
    const load = async () => {
      const response = await fetch(apiUrl(`/api/tasks/${taskId}`), {
        cache: "no-store",
      });
      if (!response.ok || stopped) return;
      const { task: full } = (await response.json()) as { task: TaskView };
      setFetched(full);
    };
    void load();
    if (status !== "running" && status !== "queued") return () => void (stopped = true);
    const id = setInterval(load, 3000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [taskId, status, reload]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [task?.logTail]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string, close = false) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível concluir");
        return;
      }
      toast.success(success);
      if (close) onOpenChange(false);
      setReload((n) => n + 1);
      router.refresh();
    });
  }

  return (
    <Sheet open={!!taskId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        {task && (
          <>
            <SheetHeader className="border-b pr-12">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <StatusIcon status={task.status} className="size-3.5" />
                {STATUS_META[task.status].label}
                {task.cancelRequested && task.status === "running" && " · cancelando…"}
                <span>·</span>
                {task.projectName}
              </div>
              <SheetTitle className="text-base leading-snug">{task.title}</SheetTitle>
              <SheetDescription render={<div />} className="flex flex-wrap gap-1.5 pt-1">
                <AgentBadge agent={task.agent} />
                <BranchBadge task={task} />
                {task.committed && <Badge variant="secondary">commitado</Badge>}
                {(task.planModel || task.execModel || task.planFirst) && (
                  <span className="text-xs text-muted-foreground">
                    {[
                      task.planFirst && `planeja com ${task.planModel || "o padrão"}`,
                      `executa com ${task.execModel || "o padrão"}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </SheetDescription>
            </SheetHeader>

            <div className="grid flex-1 content-start gap-6 overflow-y-auto p-4">
              <Section title="Conversa">
                <TaskConversation
                  task={task}
                  onSent={() => {
                    setReload((n) => n + 1);
                    router.refresh();
                  }}
                />
              </Section>

              {task.attachments.length > 0 && (
                <Section title={`Anexos (${task.attachments.length})`}>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {task.attachments.map((file) => {
                      const url = attachmentUrl(task.id, file.id);
                      const isImage = /^image\/(png|jpeg|gif|webp)$/.test(file.mimeType);
                      return (
                        <li key={file.id}>
                          <a
                            href={url}
                            target={isImage ? "_blank" : undefined}
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-lg border p-2 transition-colors hover:bg-muted/50"
                          >
                            {isImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={url} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                            ) : (
                              <span className="grid size-10 shrink-0 place-content-center rounded-md bg-muted">
                                <FileIcon className="size-4 text-muted-foreground" />
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{file.name}</span>
                              <span className="block text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                            </span>
                            <DownloadIcon className="size-4 shrink-0 text-muted-foreground" />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </Section>
              )}

              {task.logTail && (
                <Section title={task.status === "running" ? "Log (ao vivo)" : "Log"}>
                  <pre
                    ref={logRef}
                    className="max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap"
                  >
                    {task.logTail}
                  </pre>
                </Section>
              )}

              <Separator />

              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Cadastrada</dt>
                <dd>
                  {formatDateTime(task.createdAt)} <span className="text-muted-foreground">({task.source})</span>
                </dd>
                {task.baseBranch && (
                  <>
                    <dt className="text-muted-foreground">A partir de</dt>
                    <dd className="font-mono text-xs leading-5">{task.baseBranch}</dd>
                  </>
                )}
                {task.runner && (
                  <>
                    <dt className="text-muted-foreground">Executor</dt>
                    <dd>{task.runner}</dd>
                  </>
                )}
                {task.startedAt && (
                  <>
                    <dt className="text-muted-foreground">Início</dt>
                    <dd>{formatDateTime(task.startedAt)}</dd>
                  </>
                )}
                {task.finishedAt && (
                  <>
                    <dt className="text-muted-foreground">Fim</dt>
                    <dd>{formatDateTime(task.finishedAt)}</dd>
                  </>
                )}
              </dl>
            </div>

            <SheetFooter className="flex-row justify-end gap-2 border-t">
              <EditTaskDialog task={task} onSaved={() => { setReload((n) => n + 1); router.refresh(); }} />
              {pending && <Loader2Icon className="mr-auto size-4 animate-spin text-muted-foreground" />}
              {(task.status === "queued" || task.status === "running") && (
                <Button
                  variant="destructive"
                  disabled={pending || task.cancelRequested}
                  onClick={() =>
                    run(
                      () => taskCommand(task.id, "cancel"),
                      task.status === "running" ? "Cancelamento pedido" : "Tarefa cancelada",
                    )
                  }
                >
                  <BanIcon /> {task.status === "running" ? "Interromper" : "Cancelar"}
                </Button>
              )}
              {task.status !== "queued" && task.status !== "running" && (
                <>
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => removeTask(task.id), "Tarefa excluída", true)}
                  >
                    <Trash2Icon /> Excluir
                  </Button>
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => taskCommand(task.id, "retry"), "Tarefa de volta na fila")}
                  >
                    <RotateCcwIcon /> Rodar de novo
                  </Button>
                </>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
