import { getAction } from "./actions";
import type { ApiMessage, LlmEvent } from "./llm";
import type { Outcome } from "./outcome";
import { danglingToolCalls, type AssistantEvent, type AssistantRequest, type HistoryMessage, type ToolCall } from "./protocol";
import { ARG_SCHEMAS } from "./schemas";

/** O que o laço precisa de fora: o modelo e o executor das ações. Injetados, para testar sem rede nem banco. */
export type AgentDeps = {
  chat: (messages: ApiMessage[]) => AsyncGenerator<LlmEvent>;
  /** Executa uma ação já validada. */
  execute: (name: string, args: unknown) => Promise<Outcome>;
  /** Descreve o que uma ação destrutiva vai afetar, para o pedido de confirmação. */
  preview?: (name: string, args: unknown) => Promise<string | undefined>;
  onError: (message: string, error: unknown) => void | Promise<void>;
};

export type AgentInput = {
  request: AssistantRequest;
  systemPrompt: string;
  maxSteps: number;
  signal?: AbortSignal;
  emit: (event: AssistantEvent) => void;
};

const MAX_RESULT_CHARS = 120_000;

/** O que o modelo recebe de volta: resumo e dados, truncados para não estourar o contexto. */
export function toModelContent(outcome: Outcome): string {
  const body = outcome.ok
    ? { ok: true, summary: outcome.summary, ...(outcome.data !== undefined ? { data: outcome.data } : {}) }
    : { ok: false, error: outcome.error };

  const text = JSON.stringify(body);
  if (text.length <= MAX_RESULT_CHARS) return text;
  return JSON.stringify({ ok: outcome.ok, truncated: true, aviso: "Resultado grande demais; parte foi cortada.", preview: text.slice(0, MAX_RESULT_CHARS) });
}

const errorOutcome = (error: string): Outcome => ({ ok: false, error });

export async function runAssistant(input: AgentInput, deps: AgentDeps): Promise<void> {
  const { request, systemPrompt, maxSteps, signal, emit } = input;
  const history: HistoryMessage[] = [...request.messages];
  let unsent: HistoryMessage[] = [];

  const append = (message: HistoryMessage) => {
    history.push(message);
    unsent.push(message);
  };
  const flush = () => {
    if (unsent.length === 0) return;
    emit({ type: "history", messages: unsent });
    unsent = [];
  };

  /** Executa as chamadas em ordem. Devolve "paused" ao chegar numa que espera a decisão do usuário. */
  async function executeCalls(calls: ToolCall[]): Promise<"done" | "paused"> {
    for (const call of calls) {
      const { name } = call.function;
      const reply = (outcome: Outcome, extra: { mutated?: boolean } = {}) => {
        append({ role: "tool", tool_call_id: call.id, content: toModelContent(outcome) });
        flush();
        emit(
          outcome.ok
            ? { type: "tool_result", id: call.id, name, ok: true, summary: outcome.summary, changes: outcome.changes, links: outcome.links, mutated: !!(extra.mutated ?? outcome.mutated) }
            : { type: "tool_result", id: call.id, name, ok: false, summary: outcome.error, mutated: false },
        );
      };

      let args: unknown;
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        emit({ type: "tool_call", id: call.id, name, args: call.function.arguments, needsConfirm: false });
        reply(errorOutcome("Os argumentos não são um JSON válido. Chame a ferramenta de novo com JSON correto."));
        continue;
      }

      const action = getAction(name);
      if (!action?.enabled) {
        emit({ type: "tool_call", id: call.id, name, args, needsConfirm: false });
        reply(errorOutcome(`A ação "${name}" não existe ou está desativada.`));
        continue;
      }

      const parsed = ARG_SCHEMAS[name as keyof typeof ARG_SCHEMAS].safeParse(args);
      if (!parsed.success) {
        emit({ type: "tool_call", id: call.id, name, args, needsConfirm: false });
        const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.message}`).join("; ");
        reply(errorOutcome(`Argumentos inválidos: ${issues}`));
        continue;
      }

      emit({ type: "tool_call", id: call.id, name, args: parsed.data, needsConfirm: action.confirm });

      if (action.confirm) {
        const decision = request.decisions?.[call.id];
        if (decision === undefined) {
          emit({ type: "confirm", id: call.id, name, args: parsed.data, summary: await deps.preview?.(name, parsed.data) });
          return "paused";
        }
        if (!decision) {
          reply(errorOutcome("O usuário recusou esta ação. Não tente executá-la de novo sem ele pedir."));
          continue;
        }
      }

      try {
        reply(await deps.execute(name, parsed.data));
      } catch (error) {
        await deps.onError(`Falha ao executar a ação ${name}`, error);
        reply(errorOutcome("Erro interno ao executar a ação."));
      }
    }
    return "done";
  }

  try {
    const dangling = danglingToolCalls(history);
    if (dangling.length > 0) {
      if ((await executeCalls(dangling)) === "paused") {
        emit({ type: "done" });
        return;
      }
    } else if (history[history.length - 1].role !== "user") {
      emit({ type: "error", message: "A conversa está em um estado inválido. Comece uma nova conversa." });
      return;
    }

    for (let step = 0; step < maxSteps; step++) {
      if (signal?.aborted) return;

      let message: Extract<LlmEvent, { type: "message" }>["message"] | undefined;
      for await (const event of deps.chat([{ role: "system", content: systemPrompt }, ...history])) {
        if (event.type === "message") message = event.message;
        else emit(event);
      }

      if (!message || (message.content === null && !message.tool_calls?.length)) {
        emit({ type: "error", message: "O modelo respondeu vazio. Tente reformular o pedido." });
        return;
      }

      append({ role: "assistant", ...message });
      flush();

      if (!message.tool_calls?.length) {
        emit({ type: "done" });
        return;
      }
      if ((await executeCalls(message.tool_calls)) === "paused") {
        emit({ type: "done" });
        return;
      }
    }

    emit({ type: "error", message: `O assistente atingiu o limite de ${maxSteps} passos nesta mensagem. Peça para continuar, se for o caso.` });
  } catch (error) {
    if (signal?.aborted) return;
    await deps.onError("Falha na conversa com o provedor de IA", error);
    emit({ type: "error", message: error instanceof Error ? error.message : "Erro inesperado no assistente." });
  }
}
