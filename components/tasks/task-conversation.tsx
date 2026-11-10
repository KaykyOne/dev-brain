"use client";

import { BotIcon, ClipboardListIcon, Loader2Icon, SendIcon, UserIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { MarkdownPreview } from "@/components/markdown/markdown-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { sendTaskMessage } from "@/lib/tasks/actions";
import type { TaskMessageView, TaskView } from "@/lib/tasks/service";
import { cn } from "@/lib/utils";
import { MODEL_SUGGESTIONS, TASK_AGENT_LABELS } from "@/lib/validations/task";

function Bubble({
  role,
  title,
  meta,
  children,
}: {
  role: "user" | "agent" | "plan";
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  const Icon = role === "user" ? UserIcon : role === "plan" ? ClipboardListIcon : BotIcon;
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "mt-0.5 grid size-7 shrink-0 place-content-center rounded-full",
          role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="font-medium">{title}</span>
          {meta && <span className="text-muted-foreground">{meta}</span>}
        </div>
        {children}
      </div>
    </li>
  );
}

/** Conversa da tarefa: pedido, plano, respostas do agente e continuações; com caixa para continuar. */
export function TaskConversation({ task, onSent }: { task: TaskView; onSent: () => void }) {
  const [text, setText] = useState("");
  const [model, setModel] = useState("");
  const [pending, startTransition] = useTransition();

  const agentName = TASK_AGENT_LABELS[task.agent];
  const messages: TaskMessageView[] = task.messages ?? [];
  // Tarefas antigas (antes da conversa ser guardada): mostra o resumo/erro como resposta.
  const legacy = messages.length === 0 && (task.summary || (task.error && task.status !== "done"));
  const canFollowUp = task.hasSession && task.status !== "queued" && task.status !== "running";

  function send() {
    const content = text.trim();
    if (!content) return;
    startTransition(async () => {
      const result = await sendTaskMessage(task.id, { content, model });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setText("");
      toast.success("Mensagem enviada", { description: task.runner ? `${task.runner} continua a conversa.` : undefined });
      onSent();
    });
  }

  return (
    <div className="grid gap-4">
      <ol className="grid gap-4">
        <Bubble role="user" title="Você" meta={formatDateTime(task.createdAt)}>
          <MarkdownPreview source={task.prompt} />
        </Bubble>

        {messages.map((m) =>
          m.role === "plan" ? (
            <Bubble key={m.id} role="plan" title="Plano" meta={m.model ?? task.planModel ?? undefined}>
              <details className="group rounded-lg border bg-muted/30">
                <summary className="cursor-pointer px-3 py-2 text-sm text-muted-foreground select-none group-open:border-b">
                  Ver o plano
                </summary>
                <MarkdownPreview source={m.content} className="p-3" />
              </details>
            </Bubble>
          ) : (
            <Bubble
              key={m.id}
              role={m.role}
              title={m.role === "user" ? "Você" : agentName}
              meta={[m.model, formatDateTime(m.createdAt)].filter(Boolean).join(" · ")}
            >
              <MarkdownPreview
                source={m.content}
                className={cn(m.role === "agent" && "rounded-lg border bg-muted/30 p-3", m.content.startsWith("Falhou:") && "border-destructive/30 text-destructive")}
              />
            </Bubble>
          ),
        )}

        {legacy && (
          <Bubble role="agent" title={agentName}>
            <MarkdownPreview source={task.summary ?? task.error ?? ""} className="rounded-lg border bg-muted/30 p-3" />
          </Bubble>
        )}

        {(task.status === "running" || task.isFollowUp) && (
          <Bubble role="agent" title={agentName}>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              {task.status === "running"
                ? `Trabalhando${task.runner ? ` em ${task.runner}` : ""}…`
                : `Na fila: ${task.runner ?? "a mesma máquina"} continua quando estiver com o projeto aberto.`}
            </p>
          </Bubble>
        )}
      </ol>

      {canFollowUp && (
        <div className="grid gap-2 rounded-xl border p-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia; Shift+Enter quebra linha; não envia no meio de uma composição (acentos/IME).
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={3}
            placeholder="Continuar a conversa: peça ajustes, testes, explicações… (Enter envia, Shift+Enter quebra linha)"
            className="max-h-60 border-0 bg-transparent p-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
            aria-label="Mensagem para o agente"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              list="followup-model-suggestions"
              placeholder={task.execModel ? `modelo: ${task.execModel}` : "modelo: padrão"}
              className="h-7 w-44 font-mono text-xs"
              aria-label="Modelo para esta mensagem"
            />
            <datalist id="followup-model-suggestions">
              {MODEL_SUGGESTIONS[task.agent].map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <span className="text-xs text-muted-foreground">
              Retoma a mesma sessão{task.runner ? ` em ${task.runner}` : ""}, na mesma branch.
            </span>
            <Button size="sm" className="ml-auto" disabled={pending || !text.trim()} onClick={send}>
              {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
              Enviar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
