"use client";

import {
  BanIcon,
  BrainIcon,
  CheckCircle2Icon,
  FileTextIcon,
  FolderGitIcon,
  GlobeIcon,
  LoaderCircleIcon,
  PlugZapIcon,
  ShieldAlertIcon,
  SparklesIcon,
  Trash2Icon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { MarkdownPreview } from "@/components/markdown/markdown-preview";
import { Button } from "@/components/ui/button";
import { actionLabel } from "@/lib/assistant/actions";
import { argBrief, type ToolStatus, type UiItem } from "@/lib/assistant/chat-model";
import { cn } from "@/lib/utils";

const ACTION_ICONS: Record<string, LucideIcon> = {
  list_projects: FolderGitIcon,
  get_project: FolderGitIcon,
  create_project: FolderGitIcon,
  update_project: FolderGitIcon,
  delete_project: Trash2Icon,
  list_skills: SparklesIcon,
  get_skill: SparklesIcon,
  create_skill: SparklesIcon,
  update_skill: SparklesIcon,
  delete_skill: Trash2Icon,
  apply_library_skill: PlugZapIcon,
  promote_skill: GlobeIcon,
  list_context_files: FileTextIcon,
  read_context_file: FileTextIcon,
  write_context_file: FileTextIcon,
};

const STATUS: Record<ToolStatus, { icon: LucideIcon; className: string; spin?: boolean; label: string }> = {
  running: { icon: LoaderCircleIcon, className: "text-muted-foreground", spin: true, label: "Executando" },
  awaiting: { icon: ShieldAlertIcon, className: "text-amber-600 dark:text-amber-400", label: "Aguardando aprovação" },
  done: { icon: CheckCircle2Icon, className: "text-emerald-600 dark:text-emerald-400", label: "Concluído" },
  error: { icon: XCircleIcon, className: "text-destructive", label: "Falhou" },
  denied: { icon: BanIcon, className: "text-muted-foreground", label: "Não executada" },
};

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm whitespace-pre-wrap break-words text-primary-foreground">{text}</p>
    </div>
  );
}

export function AssistantBubble({ item }: { item: Extract<UiItem, { kind: "assistant" }> }) {
  return (
    <div className="space-y-2">
      {item.reasoning && (
        <details className="group text-xs text-muted-foreground" open={item.streaming && !item.text}>
          <summary className="flex cursor-pointer items-center gap-1.5 select-none">
            <BrainIcon className="size-3.5" /> Raciocínio
          </summary>
          <p className="mt-1 max-h-40 overflow-y-auto border-l pl-3 whitespace-pre-wrap break-words">{item.reasoning}</p>
        </details>
      )}
      {item.text && <MarkdownPreview source={item.text} className="text-sm" />}
      {item.streaming && !item.text && !item.reasoning && <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" aria-label="Pensando" />}
    </div>
  );
}

export function ErrorNote({ text }: { text: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      <XCircleIcon className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 break-words">{text}</span>
    </div>
  );
}

type ToolStepProps = {
  item: Extract<UiItem, { kind: "tool" }>;
  disabled: boolean;
  onDecide: (id: string, approved: boolean) => void;
};

/** Um passo do assistente: o que ele está fazendo, o resultado e, se destrutivo, o pedido de aprovação. */
export function ToolStep({ item, disabled, onDecide }: ToolStepProps) {
  const status = STATUS[item.status];
  const ActionIcon = ACTION_ICONS[item.name] ?? SparklesIcon;
  const StatusIcon = status.icon;
  const brief = argBrief(item.args);

  return (
    <div
      className={cn(
        "rounded-lg border bg-background text-sm",
        item.status === "awaiting" && "border-amber-500/50 bg-amber-500/5",
        item.status === "error" && "border-destructive/30",
      )}
    >
      <div className="flex items-start gap-2.5 p-2.5">
        <StatusIcon className={cn("mt-0.5 size-4 shrink-0", status.className, status.spin && "animate-spin")} aria-label={status.label} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="flex flex-wrap items-center gap-x-1.5 font-medium">
            <ActionIcon className="size-3.5 text-muted-foreground" />
            {actionLabel(item.name)}
            {brief && <span className="font-normal text-muted-foreground">· {brief}</span>}
          </p>

          {item.status === "awaiting" && (
            <>
              <p className="text-xs">{item.confirmSummary ?? "Esta ação precisa da sua aprovação antes de ser executada."}</p>
              <div className="flex gap-2 pt-0.5">
                <Button size="xs" variant="destructive" disabled={disabled} onClick={() => onDecide(item.id, true)}>
                  Aprovar
                </Button>
                <Button size="xs" variant="outline" disabled={disabled} onClick={() => onDecide(item.id, false)}>
                  Recusar
                </Button>
              </div>
            </>
          )}

          {item.summary && item.status !== "awaiting" && (
            <p className={cn("text-xs break-words", item.status === "error" ? "text-destructive" : "text-muted-foreground")}>{item.summary}</p>
          )}

          {item.changes && item.changes.length > 0 && (
            <ul className="space-y-1 rounded-md bg-muted/50 p-2 text-xs">
              {item.changes.map((change) => (
                <li key={change.field} className="break-words">
                  <span className="font-medium">{change.field}</span>
                  {change.before !== undefined && <span className="text-muted-foreground line-through decoration-muted-foreground/40"> {change.before}</span>}
                  {change.before !== undefined && change.after !== undefined && " → "}
                  {change.after !== undefined && <span className="text-emerald-700 dark:text-emerald-400"> {change.after}</span>}
                </li>
              ))}
            </ul>
          )}

          {item.links && item.links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.links.map((link) => (
                <Link key={link.href} href={link.href} className="text-xs underline underline-offset-2 hover:text-foreground">
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">Detalhes</summary>
            <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-muted/50 p-2 font-mono whitespace-pre-wrap break-words">{JSON.stringify(item.args, null, 2)}</pre>
          </details>
        </div>
      </div>
    </div>
  );
}
