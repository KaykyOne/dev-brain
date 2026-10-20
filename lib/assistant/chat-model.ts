import { danglingToolCalls, type AssistantEvent, type Change, type HistoryMessage, type ResultLink } from "./protocol";

/** Estado do chat no navegador: o que aparece na tela (itens) e o histórico enviado ao servidor. Puro e testável. */

export type ToolStatus = "running" | "awaiting" | "done" | "error" | "denied";

export type UiItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "assistant"; id: string; text: string; reasoning: string; streaming: boolean }
  | {
      kind: "tool";
      id: string;
      name: string;
      args: unknown;
      status: ToolStatus;
      summary?: string;
      confirmSummary?: string;
      changes?: Change[];
      links?: ResultLink[];
    }
  | { kind: "error"; id: string; text: string };

export type ChatState = { items: UiItem[]; history: HistoryMessage[]; busy: boolean };

export const initialChat: ChatState = { items: [], history: [], busy: false };

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

function finishStreaming(items: UiItem[]): UiItem[] {
  return items.map((item) => (item.kind === "assistant" && item.streaming ? { ...item, streaming: false } : item));
}

/** Aplica um evento do servidor ao estado. */
export function applyEvent(state: ChatState, event: AssistantEvent): ChatState {
  switch (event.type) {
    case "text":
    case "reasoning": {
      const last = state.items.at(-1);
      const field = event.type === "text" ? "text" : "reasoning";
      if (last?.kind === "assistant" && last.streaming) {
        const updated = { ...last, [field]: last[field] + event.delta };
        return { ...state, items: [...state.items.slice(0, -1), updated] };
      }
      const created: UiItem = { kind: "assistant", id: nextId("a"), text: "", reasoning: "", streaming: true, [field]: event.delta };
      return { ...state, items: [...state.items, created] };
    }

    case "history":
      return { ...state, history: [...state.history, ...event.messages], items: event.messages.some((m) => m.role === "assistant") ? finishStreaming(state.items) : state.items };

    case "tool_call": {
      const items = finishStreaming(state.items);
      const index = items.findIndex((item) => item.kind === "tool" && item.id === event.id);
      const existing = index >= 0 ? (items[index] as Extract<UiItem, { kind: "tool" }>) : null;
      const tool: UiItem = { kind: "tool", id: event.id, name: event.name, args: event.args, status: "running", changes: existing?.changes, links: existing?.links };
      return { ...state, items: index >= 0 ? items.map((item, i) => (i === index ? tool : item)) : [...items, tool] };
    }

    case "confirm":
      return {
        ...state,
        items: state.items.map((item) => (item.kind === "tool" && item.id === event.id ? { ...item, status: "awaiting" as const, confirmSummary: event.summary } : item)),
      };

    case "tool_result":
      return {
        ...state,
        items: state.items.map((item) =>
          item.kind === "tool" && item.id === event.id
            ? {
                ...item,
                // Uma recusa registrada pelo próprio usuário continua como "recusada", e não como erro.
                status: item.status === "denied" ? ("denied" as const) : event.ok ? ("done" as const) : ("error" as const),
                summary: event.summary,
                changes: event.changes,
                links: event.links,
              }
            : item,
        ),
      };

    case "error":
      return { ...state, busy: false, items: [...finishStreaming(state.items), { kind: "error", id: nextId("e"), text: event.message }] };

    case "done":
      return { ...state, busy: false, items: finishStreaming(state.items) };
  }
}

export function addUserMessage(state: ChatState, text: string): ChatState {
  return {
    ...state,
    busy: true,
    items: [...finishStreaming(state.items), { kind: "user", id: nextId("u"), text }],
    history: [...state.history, { role: "user", content: text }],
  };
}

const NOT_ANSWERED = "O usuário interrompeu ou não respondeu a esta ação. Ela NÃO foi executada.";

/**
 * Fecha as chamadas de ferramenta que ficaram sem resposta (usuário interrompeu, ou mandou outra mensagem em vez de
 * aprovar): o histórico precisa ter uma resposta para cada chamada, e nenhuma delas deve ser executada depois.
 */
export function closeDanglingCalls(state: ChatState): ChatState {
  const dangling = danglingToolCalls(state.history);
  if (dangling.length === 0) return state;

  const ids = new Set(dangling.map((call) => call.id));
  return {
    ...state,
    history: [...state.history, ...dangling.map((call): HistoryMessage => ({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ ok: false, error: NOT_ANSWERED }) }))],
    items: state.items.map((item) =>
      item.kind === "tool" && ids.has(item.id) && (item.status === "awaiting" || item.status === "running")
        ? { ...item, status: "denied" as const, summary: "Não executada" }
        : item,
    ),
  };
}

/** Marca uma ação como recusada (a decisão em si segue para o servidor). */
export function markDenied(state: ChatState, id: string): ChatState {
  return { ...state, items: state.items.map((item) => (item.kind === "tool" && item.id === id ? { ...item, status: "denied" as const } : item)) };
}

/** Ids das ações que esperam aprovação. */
export const awaitingIds = (state: ChatState) => state.items.flatMap((item) => (item.kind === "tool" && item.status === "awaiting" ? [item.id] : []));

/** Resumo curto do alvo de uma ação, para o título do passo (ex.: nome da skill ou slug do projeto). */
export function argBrief(args: unknown): string {
  if (typeof args !== "object" || args === null) return "";
  const record = args as Record<string, unknown>;
  for (const key of ["name", "slug", "path", "project", "query"]) {
    const value = record[key];
    if (typeof value === "string" && value) return value.length > 48 ? `${value.slice(0, 47)}…` : value;
  }
  return "";
}

/** Tamanho aproximado do que será guardado na sessão do navegador. */
const MAX_PERSISTED_CHARS = 400_000;

export function serializeChat(state: ChatState): string | null {
  const text = JSON.stringify({ items: state.items.map((item) => (item.kind === "assistant" ? { ...item, streaming: false } : item)), history: state.history });
  return text.length <= MAX_PERSISTED_CHARS ? text : null;
}

export function restoreChat(raw: string | null): ChatState {
  if (!raw) return initialChat;
  try {
    const parsed = JSON.parse(raw) as Partial<ChatState>;
    if (!Array.isArray(parsed.items) || !Array.isArray(parsed.history)) return initialChat;

    // Um turno interrompido por recarregamento não pode ficar "rodando" para sempre.
    const items = parsed.items.map((item) => (item.kind === "tool" && item.status === "running" ? { ...item, status: "error" as const, summary: "Interrompido" } : item));
    return closeDanglingCalls({ items, history: parsed.history, busy: false });
  } catch {
    return initialChat;
  }
}
