/** Leitura do streaming (SSE) da API de chat completions e montagem da mensagem do assistente. */

import type { ToolCall } from "./protocol";

/** Devolve o conteúdo de cada linha `data:` do SSE, parando em `[DONE]`. */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);

        if (!line.startsWith("data:")) continue; // comentários (": keep-alive") e campos que não usamos
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        if (data) yield data;
      }
    }

    const rest = buffer.trim();
    if (rest.startsWith("data:") && rest.slice(5).trim() !== "[DONE]") yield rest.slice(5).trim();
  } finally {
    reader.releaseLock();
  }
}

type ToolCallDelta = { index?: number; id?: string; function?: { name?: string; arguments?: string } };
type Chunk = {
  choices?: { delta?: { content?: string | null; reasoning_content?: string | null; tool_calls?: ToolCallDelta[] }; finish_reason?: string | null }[];
  error?: { message?: string };
};

export type AssistantMessage = {
  content: string | null;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
};

/** Junta os pedaços (deltas) de uma resposta: texto, raciocínio e chamadas de ferramenta que chegam fatiadas. */
export class MessageAccumulator {
  private content = "";
  private reasoning = "";
  private calls = new Map<number, { id: string; name: string; args: string }>();
  finishReason: string | null = null;

  /** Processa um pedaço (JSON de uma linha `data:`) e devolve o que há de novo para mostrar. */
  push(data: string): { text?: string; reasoning?: string } {
    const chunk = JSON.parse(data) as Chunk;
    if (chunk.error) throw new Error(chunk.error.message ?? "Erro do provedor de IA");

    const choice = chunk.choices?.[0];
    if (!choice) return {};
    if (choice.finish_reason) this.finishReason = choice.finish_reason;

    const delta = choice.delta;
    const added: { text?: string; reasoning?: string } = {};

    if (delta?.content) {
      this.content += delta.content;
      added.text = delta.content;
    }
    if (delta?.reasoning_content) {
      this.reasoning += delta.reasoning_content;
      added.reasoning = delta.reasoning_content;
    }
    for (const part of delta?.tool_calls ?? []) {
      const index = part.index ?? 0;
      const call = this.calls.get(index) ?? { id: "", name: "", args: "" };
      if (part.id) call.id = part.id;
      if (part.function?.name) call.name += part.function.name;
      if (part.function?.arguments) call.args += part.function.arguments;
      this.calls.set(index, call);
    }

    return added;
  }

  toMessage(): AssistantMessage {
    const tool_calls = [...this.calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, call]): ToolCall => ({
        // Alguns provedores omitem o id; geramos um estável para casar a chamada com a resposta.
        id: call.id || `call_${index}_${call.name}`,
        type: "function",
        function: { name: call.name, arguments: call.args || "{}" },
      }));

    return {
      content: this.content || null,
      ...(this.reasoning ? { reasoning_content: this.reasoning } : {}),
      ...(tool_calls.length > 0 ? { tool_calls } : {}),
    };
  }
}
