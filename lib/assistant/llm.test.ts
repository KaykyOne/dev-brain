import { describe, expect, it } from "vitest";

import { buildRequestBody, LlmError, prepareMessages, streamChat, type ApiMessage } from "./llm";
import type { AiConfig } from "./config";

const config = (over: Partial<Extract<AiConfig, { enabled: true }>> = {}): Extract<AiConfig, { enabled: true }> => ({
  enabled: true,
  provider: "deepseek",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-flash",
  apiKey: "sk-segredo",
  thinking: false,
  maxSteps: 12,
  ...over,
});

const withReasoning: ApiMessage[] = [
  { role: "user", content: "oi" },
  { role: "assistant", content: "olá", reasoning_content: "pensei" },
];

describe("buildRequestBody", () => {
  it("DeepSeek: desliga o raciocínio explicitamente (o padrão da API é ligado)", () => {
    expect(buildRequestBody(config(), [], [])).toMatchObject({ model: "deepseek-flash", stream: true, thinking: { type: "disabled" } });
  });

  it("DeepSeek com AI_THINKING=enabled liga o raciocínio", () => {
    expect(buildRequestBody(config({ thinking: true }), [], [])).toMatchObject({ thinking: { type: "enabled" } });
  });

  it("outros provedores não recebem o campo thinking", () => {
    expect(buildRequestBody(config({ provider: "openai", thinking: false }), [], [])).not.toHaveProperty("thinking");
  });
});

describe("prepareMessages", () => {
  it("mantém o reasoning_content no modo de raciocínio (o DeepSeek exige devolvê-lo)", () => {
    expect(prepareMessages(withReasoning, config({ thinking: true }))).toEqual(withReasoning);
  });

  it("remove o reasoning_content quando o raciocínio está desligado ou o provedor é outro", () => {
    for (const cfg of [config({ thinking: false }), config({ provider: "openai", thinking: false })]) {
      const out = prepareMessages(withReasoning, cfg);
      expect(out[1]).toEqual({ role: "assistant", content: "olá" });
    }
  });

  it("preserva as chamadas de ferramenta ao remover o raciocínio", () => {
    const tool_calls = [{ id: "a", type: "function" as const, function: { name: "list_projects", arguments: "{}" } }];
    const out = prepareMessages([{ role: "assistant", content: null, reasoning_content: "x", tool_calls }], config());
    expect(out[0]).toEqual({ role: "assistant", content: null, tool_calls });
  });
});

function sseResponse(lines: string[], init: ResponseInit = { status: 200 }) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const line of lines) controller.enqueue(new TextEncoder().encode(line));
        controller.close();
      },
    }),
    init,
  );
}

async function consume(generator: AsyncGenerator<unknown>) {
  const out: unknown[] = [];
  for await (const event of generator) out.push(event);
  return out;
}

describe("streamChat", () => {
  it("envia a chave no cabeçalho, chama /chat/completions e emite texto e a mensagem final", async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return sseResponse(['data: {"choices":[{"delta":{"content":"Oi"}}]}\n\n', 'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n', "data: [DONE]\n\n"]);
    }) as unknown as typeof fetch;

    const events = await consume(streamChat({ config: config(), messages: [], tools: [], fetchImpl }));

    expect(captured?.url).toBe("https://api.deepseek.com/chat/completions");
    expect((captured?.init.headers as Record<string, string>).authorization).toBe("Bearer sk-segredo");
    expect(events).toEqual([
      { type: "text", delta: "Oi" },
      { type: "message", message: { content: "Oi" }, finishReason: "stop" },
    ]);
  });

  it.each([
    [401, "recusou a chave"],
    [402, "Saldo insuficiente"],
    [404, "não encontrado"],
    [429, "limitou as requisições"],
    [503, "indisponível"],
  ])("traduz o status %i em mensagem legível, sem vazar o corpo", async (status, expected) => {
    const fetchImpl = (async () => new Response(JSON.stringify({ error: { message: "detalhe interno" } }), { status })) as unknown as typeof fetch;
    const error = await consume(streamChat({ config: config(), messages: [], tools: [], fetchImpl })).catch((e) => e);

    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).message).toContain(expected);
    expect((error as LlmError).message).not.toContain("detalhe interno");
    expect((error as LlmError).detail).toBe("detalhe interno");
  });

  it("explica falha de rede", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const error = await consume(streamChat({ config: config(), messages: [], tools: [], fetchImpl })).catch((e) => e);
    expect((error as LlmError).message).toContain("Não foi possível falar com o provedor");
  });

  it("propaga o erro de um stream que traz erro do provedor", async () => {
    const fetchImpl = (async () => sseResponse(['data: {"error":{"message":"sem saldo"}}\n\n'])) as unknown as typeof fetch;
    const error = await consume(streamChat({ config: config(), messages: [], tools: [], fetchImpl })).catch((e) => e);
    expect((error as LlmError).message).toBe("sem saldo");
  });
});
