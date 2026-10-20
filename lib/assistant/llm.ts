import type { AiConfig } from "./config";
import type { HistoryMessage } from "./protocol";
import { MessageAccumulator, parseSse, type AssistantMessage } from "./stream";

type EnabledConfig = Extract<AiConfig, { enabled: true }>;
export type ApiMessage = { role: "system"; content: string } | HistoryMessage;

export type ToolDefinition = {
  type: "function";
  function: { name: string; description: string; parameters: unknown };
};

export type LlmEvent =
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  | { type: "message"; message: AssistantMessage; finishReason: string | null };

/** Erro do provedor de IA, com uma mensagem que o usuário entende. `detail` vai só para o log. */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly detail?: string,
  ) {
    super(message);
  }
}

const REQUEST_TIMEOUT_MS = 180_000;

function friendlyMessage(status: number): string {
  if (status === 401 || status === 403) return "O provedor de IA recusou a chave de API. Confira AI_API_KEY.";
  if (status === 402) return "Saldo insuficiente no provedor de IA.";
  if (status === 404) return "Modelo ou endereço do provedor não encontrado. Confira AI_MODEL e AI_BASE_URL.";
  if (status === 429) return "O provedor de IA limitou as requisições. Tente de novo em instantes.";
  if (status >= 500) return `O provedor de IA está indisponível (${status}). Tente de novo em instantes.`;
  return `O provedor de IA recusou a requisição (${status}).`;
}

/**
 * O reasoning_content só é enviado no modo de raciocínio do DeepSeek (que exige devolvê-lo quando há ferramentas).
 * Para os demais provedores o campo é desconhecido e é removido.
 */
export function prepareMessages(messages: ApiMessage[], config: EnabledConfig): ApiMessage[] {
  const keep = config.provider === "deepseek" && config.thinking;
  if (keep) return messages;

  return messages.map((message) => {
    if (message.role !== "assistant" || !("reasoning_content" in message)) return message;
    return { role: message.role, content: message.content, ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}) };
  });
}

export function buildRequestBody(config: EnabledConfig, messages: ApiMessage[], tools: ToolDefinition[]) {
  return {
    model: config.model,
    messages: prepareMessages(messages, config),
    tools,
    stream: true,
    temperature: 0.3,
    // Extensão do DeepSeek: o raciocínio vem ligado por padrão, então o modo desligado precisa ser explícito.
    ...(config.provider === "deepseek" ? { thinking: { type: config.thinking ? "enabled" : "disabled" } } : {}),
  };
}

/** Uma rodada de chat completions com streaming. Emite texto e raciocínio conforme chegam e, no fim, a mensagem completa. */
export async function* streamChat(options: {
  config: EnabledConfig;
  messages: ApiMessage[];
  tools: ToolDefinition[];
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): AsyncGenerator<LlmEvent> {
  const { config, messages, tools, signal, fetchImpl = fetch } = options;
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(buildRequestBody(config, messages, tools)),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.aborted) throw new LlmError("O provedor de IA demorou demais para responder.");
    throw new LlmError("Não foi possível falar com o provedor de IA. Confira a conexão e AI_BASE_URL.", undefined, String(error));
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let detail = body.slice(0, 500);
    try {
      detail = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? detail;
    } catch {
      // corpo que não é JSON: usa o texto cru no log
    }
    throw new LlmError(friendlyMessage(response.status), response.status, detail);
  }
  if (!response.body) throw new LlmError("O provedor de IA respondeu sem conteúdo.");

  const accumulator = new MessageAccumulator();
  try {
    for await (const data of parseSse(response.body)) {
      const added = accumulator.push(data);
      if (added.text) yield { type: "text", delta: added.text };
      if (added.reasoning) yield { type: "reasoning", delta: added.reasoning };
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new LlmError(error instanceof Error ? error.message : "Falha ao ler a resposta do provedor de IA.", undefined, String(error));
  }

  yield { type: "message", message: accumulator.toMessage(), finishReason: accumulator.finishReason };
}
