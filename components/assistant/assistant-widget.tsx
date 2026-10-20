"use client";

import { ArrowUpIcon, BotMessageSquareIcon, KeyRoundIcon, RotateCcwIcon, SquareIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { AiPublicStatus } from "@/lib/assistant/config";
import { cn } from "@/lib/utils";

import { AssistantBubble, ErrorNote, ToolStep, UserBubble } from "./chat-parts";
import { useAssistantChat } from "./use-assistant-chat";

const SUGGESTIONS = [
  "Liste meus projetos e as skills de cada um",
  "Crie uma skill de autodeploy na biblioteca",
  "Quais skills estão sem SKILL.md?",
  "Aplique uma skill da biblioteca em um projeto",
];

function NotConfigured({ status }: { status: AiPublicStatus }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <KeyRoundIcon className="size-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="font-medium">Falta só a chave de API</p>
        <p className="text-sm text-muted-foreground">{status.reason}</p>
      </div>
      <pre className="w-full overflow-x-auto rounded-lg border bg-muted/50 p-3 text-left font-mono text-xs leading-relaxed">
        {`AI_API_KEY=sua-chave-do-deepseek\n\n# já vêm configurados:\n# AI_PROVIDER=deepseek\n# AI_MODEL=deepseek-flash`}
      </pre>
      <p className="text-xs text-muted-foreground">
        Crie a chave em platform.deepseek.com, defina <code className="font-mono">AI_API_KEY</code> no <code className="font-mono">.env</code> e reinicie o app.
      </p>
    </div>
  );
}

/** Botão flutuante no canto inferior direito que abre o chat do assistente. */
export function AssistantWidget({ status }: { status: AiPublicStatus }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const { state, send, decide, stop, reset } = useAssistantChat();

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pinnedRef = useRef(true);

  // Acompanha a resposta em streaming, a menos que o usuário tenha rolado para ler algo acima.
  useEffect(() => {
    const list = listRef.current;
    if (open && list && pinnedRef.current) list.scrollTop = list.scrollHeight;
  }, [state.items, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function submit() {
    if (!draft.trim() || state.busy) return;
    send(draft);
    setDraft("");
    pinnedRef.current = true;
  }

  const awaiting = state.items.some((item) => item.kind === "tool" && item.status === "awaiting");

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="Assistente de IA"
          onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
          className="fixed inset-x-2 top-16 bottom-20 z-50 flex flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl sm:inset-x-auto sm:top-auto sm:right-4 sm:bottom-20 sm:h-[min(44rem,calc(100svh-7rem))] sm:w-[30rem]"
        >
          <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Assistente</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{status.enabled ? `${status.provider} · ${status.model}` : "não configurado"}</p>
            </div>
            <div className="flex shrink-0 items-center">
              {state.items.length > 0 && (
                <Button variant="ghost" size="icon-sm" title="Nova conversa" aria-label="Nova conversa" onClick={reset}>
                  <RotateCcwIcon />
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" title="Fechar" aria-label="Fechar assistente" onClick={() => setOpen(false)}>
                <XIcon />
              </Button>
            </div>
          </header>

          {!status.enabled ? (
            <NotConfigured status={status} />
          ) : (
            <>
              <div
                ref={listRef}
                aria-live="polite"
                className="flex-1 space-y-3 overflow-y-auto p-3"
                onScroll={(event) => {
                  const el = event.currentTarget;
                  pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                }}
              >
                {state.items.length === 0 ? (
                  <div className="space-y-3 pt-4">
                    <p className="text-sm text-muted-foreground">
                      Peça para criar e atualizar skills, aplicar skills da biblioteca em projetos, criar projetos e mexer nos arquivos de contexto. Cada passo aparece aqui.
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => send(suggestion)}
                          className="rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  state.items.map((item) =>
                    item.kind === "user" ? (
                      <UserBubble key={item.id} text={item.text} />
                    ) : item.kind === "assistant" ? (
                      <AssistantBubble key={item.id} item={item} />
                    ) : item.kind === "tool" ? (
                      <ToolStep key={item.id} item={item} disabled={state.busy} onDecide={decide} />
                    ) : (
                      <ErrorNote key={item.id} text={item.text} />
                    ),
                  )
                )}
              </div>

              <footer className="border-t p-2">
                {awaiting && <p className="px-1 pb-1.5 text-xs text-amber-700 dark:text-amber-400">Aprove ou recuse a ação acima para continuar.</p>}
                <div className="flex items-end gap-2 rounded-lg border bg-background p-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    rows={1}
                    placeholder="Peça algo ao assistente…"
                    aria-label="Mensagem para o assistente"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        submit();
                      }
                    }}
                    className="max-h-32 min-h-8 flex-1 resize-none bg-transparent px-1.5 py-1 text-sm outline-none [field-sizing:content] placeholder:text-muted-foreground"
                  />
                  {state.busy ? (
                    <Button size="icon-sm" variant="secondary" aria-label="Parar" title="Parar" onClick={stop}>
                      <SquareIcon />
                    </Button>
                  ) : (
                    <Button size="icon-sm" aria-label="Enviar" title="Enviar (Enter)" disabled={!draft.trim()} onClick={submit}>
                      <ArrowUpIcon />
                    </Button>
                  )}
                </div>
              </footer>
            </>
          )}
        </section>
      )}

      <Button
        size="icon"
        aria-label={open ? "Fechar assistente" : "Abrir assistente"}
        aria-expanded={open}
        title="Assistente"
        onClick={() => setOpen((current) => !current)}
        className={cn("fixed right-4 bottom-4 z-50 size-12 rounded-full shadow-lg", state.busy && !open && "animate-pulse")}
      >
        {open ? <XIcon className="size-5" /> : <BotMessageSquareIcon className="size-5" />}
      </Button>
    </>
  );
}
