import {
  BanIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  GitBranchIcon,
  Loader2Icon,
  SparklesIcon,
  TerminalIcon,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { TaskView } from "@/lib/tasks/service";
import { cn } from "@/lib/utils";
import { TASK_AGENT_LABELS } from "@/lib/validations/task";

export const STATUS_META: Record<TaskView["status"], { label: string; section: string; icon: LucideIcon; className: string }> = {
  running: { label: "Executando", section: "Executando", icon: Loader2Icon, className: "animate-spin text-[var(--series-1)]" },
  queued: { label: "Na fila", section: "Na fila", icon: ClockIcon, className: "text-muted-foreground" },
  failed: { label: "Falhou", section: "Com falha", icon: CircleXIcon, className: "text-destructive" },
  done: { label: "Concluída", section: "Concluídas", icon: CircleCheckIcon, className: "text-[var(--series-3)]" },
  cancelled: { label: "Cancelada", section: "Canceladas", icon: BanIcon, className: "text-muted-foreground" },
};

export const STATUS_ORDER: TaskView["status"][] = ["running", "queued", "failed", "done", "cancelled"];

export function StatusIcon({ status, className }: { status: TaskView["status"]; className?: string }) {
  const meta = STATUS_META[status];
  return <meta.icon aria-label={meta.label} className={cn("size-4 shrink-0", meta.className, className)} />;
}

export function AgentBadge({ agent }: { agent: TaskView["agent"] }) {
  const Icon = agent === "codex" ? TerminalIcon : SparklesIcon;
  return (
    <Badge variant="secondary">
      <Icon />
      {TASK_AGENT_LABELS[agent]}
    </Badge>
  );
}

/** Branch em que o trabalho ficou, a pedida, ou "nova (IA escolhe)". */
export function taskBranchLabel(task: Pick<TaskView, "resultBranch" | "branch" | "branchMode">) {
  return task.resultBranch ?? task.branch ?? (task.branchMode === "new" ? "nova branch (IA escolhe)" : "—");
}

export function BranchBadge({ task }: { task: Pick<TaskView, "resultBranch" | "branch" | "branchMode"> }) {
  const named = !!(task.resultBranch ?? task.branch);
  return (
    <Badge variant="outline" className={cn("max-w-full", named && "font-mono")}>
      <GitBranchIcon />
      <span className="truncate">{taskBranchLabel(task)}</span>
    </Badge>
  );
}

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}min`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
