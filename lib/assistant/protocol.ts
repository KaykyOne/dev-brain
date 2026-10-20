import { z } from "zod";

/** Contrato entre o chat (navegador) e a rota do assistente. Compartilhado: não importa nada do servidor. */

const MAX_MESSAGE_CHARS = 100_000;
const MAX_TOTAL_CHARS = 400_000;
const MAX_HISTORY_MESSAGES = 120;

const toolCallSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.literal("function"),
  function: z.object({ name: z.string().min(1).max(100), arguments: z.string().max(MAX_MESSAGE_CHARS) }),
});

const historyMessageSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), content: z.string().min(1).max(MAX_MESSAGE_CHARS) }),
  z.object({
    role: z.literal("assistant"),
    content: z.string().max(MAX_MESSAGE_CHARS).nullable(),
    reasoning_content: z.string().max(MAX_MESSAGE_CHARS).optional(),
    tool_calls: z.array(toolCallSchema).max(20).optional(),
  }),
  z.object({ role: z.literal("tool"), tool_call_id: z.string().min(1).max(200), content: z.string().max(MAX_MESSAGE_CHARS) }),
]);

export const requestSchema = z
  .object({
    messages: z.array(historyMessageSchema).min(1).max(MAX_HISTORY_MESSAGES),
    /** Decisões do usuário sobre ações que pedem confirmação: id da chamada → aprovada. */
    decisions: z.record(z.string(), z.boolean()).optional(),
    /** Página em que o usuário está (ex.: /projects/alfa), para dar contexto ao assistente. */
    page: z.string().max(300).optional(),
  })
  .refine((request) => JSON.stringify(request.messages).length <= MAX_TOTAL_CHARS, {
    message: "Conversa muito longa. Comece uma nova conversa.",
    path: ["messages"],
  });

export type HistoryMessage = z.infer<typeof historyMessageSchema>;
export type ToolCall = z.infer<typeof toolCallSchema>;
export type AssistantRequest = z.infer<typeof requestSchema>;

export type Change = { field: string; before?: string; after?: string };
export type ResultLink = { label: string; href: string };

/** Eventos enviados ao navegador, um JSON por linha (NDJSON). */
export type AssistantEvent =
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  | { type: "tool_call"; id: string; name: string; args: unknown; needsConfirm: boolean }
  | {
      type: "tool_result";
      id: string;
      name: string;
      ok: boolean;
      summary: string;
      changes?: Change[];
      links?: ResultLink[];
      mutated: boolean;
    }
  | { type: "confirm"; id: string; name: string; args: unknown; summary?: string }
  | { type: "history"; messages: HistoryMessage[] }
  | { type: "done" }
  | { type: "error"; message: string };

/** Chamadas de ferramenta do último turno do assistente que ainda não têm resposta (aguardam confirmação). */
export function danglingToolCalls(messages: HistoryMessage[]): ToolCall[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === "assistant") {
      const answered = new Set(
        messages.slice(i + 1).flatMap((next) => (next.role === "tool" ? [next.tool_call_id] : [])),
      );
      return (message.tool_calls ?? []).filter((call) => !answered.has(call.id));
    }
    if (message.role === "user") return [];
  }
  return [];
}
