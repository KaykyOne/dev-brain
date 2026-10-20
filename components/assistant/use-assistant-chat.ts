"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { apiUrl } from "@/lib/api-url";
import {
  addUserMessage,
  applyEvent,
  awaitingIds,
  closeDanglingCalls,
  initialChat,
  markDenied,
  restoreChat,
  serializeChat,
  type ChatState,
} from "@/lib/assistant/chat-model";
import type { AssistantEvent } from "@/lib/assistant/protocol";

const STORAGE_KEY = "devbrain-assistant-v1";

function readStorage(): ChatState {
  try {
    return typeof window === "undefined" ? initialChat : restoreChat(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return initialChat;
  }
}

/** Lê o corpo da resposta (NDJSON) e entrega um evento por linha. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AssistantEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      try {
        yield JSON.parse(line) as AssistantEvent;
      } catch {
        // linha incompleta ou inválida: ignora
      }
    }
  }
}

export function useAssistantChat() {
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState<ChatState>(readStorage);
  // O histórico enviado ao servidor precisa ser o mais recente no instante do envio: espelha o estado em uma ref.
  const stateRef = useRef(state);
  const abortRef = useRef<AbortController | null>(null);

  const update = (change: (current: ChatState) => ChatState) => {
    stateRef.current = change(stateRef.current);
    setState(stateRef.current);
  };

  // Guarda a conversa na sessão do navegador. Só com o chat ocioso (durante o streaming o estado muda a cada pedaço)
  // e sem atraso, para um recarregamento logo após a resposta não perder os últimos passos.
  useEffect(() => {
    if (state.busy) return;
    try {
      const raw = serializeChat(state);
      if (raw) window.sessionStorage.setItem(STORAGE_KEY, raw);
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // armazenamento indisponível: a conversa só não sobrevive ao recarregamento
    }
  }, [state]);

  async function run(decisions?: Record<string, boolean>) {
    const controller = new AbortController();
    abortRef.current = controller;
    update((current) => ({ ...current, busy: true }));

    let mutated = false;
    try {
      const response = await fetch(apiUrl("/api/assistant"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: stateRef.current.history, decisions, page: pathname }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const message = await response.json().then((json: { error?: string }) => json.error, () => undefined);
        update((current) => applyEvent(current, { type: "error", message: message ?? `Erro ${response.status} ao falar com o assistente.` }));
        return;
      }

      for await (const event of readEvents(response.body)) {
        update((current) => applyEvent(current, event));
        if (event.type === "tool_result" && event.mutated) mutated = true;
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        update((current) => applyEvent(current, { type: "error", message: error instanceof Error ? `Conexão interrompida: ${error.message}` : "Conexão interrompida." }));
      }
    } finally {
      update((current) => (current.busy ? { ...current, busy: false } : current));
      // As páginas mostram dados do servidor: depois de uma alteração, atualiza o que está na tela.
      if (mutated) router.refresh();
    }
  }

  return {
    state,
    /** Envia uma mensagem. Confirmações pendentes que o usuário ignorou viram "não executadas". */
    send(text: string) {
      const message = text.trim();
      if (!message || stateRef.current.busy) return;
      update(closeDanglingCalls);
      update((current) => addUserMessage(current, message));
      void run();
    },
    /** Aprova ou recusa uma ação que pediu confirmação e continua a conversa. */
    decide(id: string, approved: boolean) {
      if (stateRef.current.busy || !awaitingIds(stateRef.current).includes(id)) return;
      if (!approved) update((current) => markDenied(current, id));
      void run({ [id]: approved });
    },
    stop() {
      abortRef.current?.abort();
      update((current) => closeDanglingCalls(applyEvent({ ...current, busy: false }, { type: "done" })));
    },
    reset() {
      abortRef.current?.abort();
      update(() => initialChat);
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // sem armazenamento
      }
    },
  };
}
