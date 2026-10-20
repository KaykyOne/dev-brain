import { describe, expect, it } from "vitest";

import { danglingToolCalls, type HistoryMessage } from "./protocol";
import { MessageAccumulator, parseSse } from "./stream";

const streamOf = (...parts: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(new TextEncoder().encode(part));
      controller.close();
    },
  });

async function collect(body: ReadableStream<Uint8Array>) {
  const out: string[] = [];
  for await (const data of parseSse(body)) out.push(data);
  return out;
}

describe("parseSse", () => {
  it("lê eventos data e para em [DONE]", async () => {
    expect(await collect(streamOf('data: {"a":1}\n\ndata: {"a":2}\n\ndata: [DONE]\n\ndata: {"a":3}\n\n'))).toEqual(['{"a":1}', '{"a":2}']);
  });

  it("junta linhas partidas entre pedaços de rede e aceita CRLF", async () => {
    expect(await collect(streamOf('da', 'ta: {"x":', '1}\r\n\r\ndata: [DONE]\r\n'))).toEqual(['{"x":1}']);
  });

  it("ignora comentários de keep-alive e linhas sem data", async () => {
    expect(await collect(streamOf(': keep-alive\n\nevent: ping\ndata: {"ok":true}\n\n'))).toEqual(['{"ok":true}']);
  });

  it("aproveita o último evento sem quebra de linha final", async () => {
    expect(await collect(streamOf('data: {"fim":true}'))).toEqual(['{"fim":true}']);
  });
});

describe("MessageAccumulator", () => {
  const chunk = (delta: object, finish: string | null = null) => JSON.stringify({ choices: [{ delta, finish_reason: finish }] });

  it("acumula texto e devolve cada pedaço novo", () => {
    const acc = new MessageAccumulator();
    expect(acc.push(chunk({ content: "Olá" }))).toEqual({ text: "Olá" });
    expect(acc.push(chunk({ content: ", mundo" }, "stop"))).toEqual({ text: ", mundo" });
    expect(acc.toMessage()).toEqual({ content: "Olá, mundo" });
    expect(acc.finishReason).toBe("stop");
  });

  it("guarda o raciocínio separado do texto", () => {
    const acc = new MessageAccumulator();
    expect(acc.push(chunk({ reasoning_content: "pensando" }))).toEqual({ reasoning: "pensando" });
    acc.push(chunk({ content: "resposta" }));
    expect(acc.toMessage()).toEqual({ content: "resposta", reasoning_content: "pensando" });
  });

  it("monta chamadas de ferramenta que chegam fatiadas, em ordem de índice", () => {
    const acc = new MessageAccumulator();
    acc.push(chunk({ tool_calls: [{ index: 1, id: "b", function: { name: "get_skill", arguments: '{"slug"' } }] }));
    acc.push(chunk({ tool_calls: [{ index: 0, id: "a", function: { name: "list_projects", arguments: "{}" } }] }));
    acc.push(chunk({ tool_calls: [{ index: 1, function: { arguments: ':"x"}' } }] }, "tool_calls"));

    expect(acc.toMessage().tool_calls).toEqual([
      { id: "a", type: "function", function: { name: "list_projects", arguments: "{}" } },
      { id: "b", type: "function", function: { name: "get_skill", arguments: '{"slug":"x"}' } },
    ]);
  });

  it("gera um id quando o provedor não manda e usa {} para argumentos vazios", () => {
    const acc = new MessageAccumulator();
    acc.push(chunk({ tool_calls: [{ index: 0, function: { name: "list_projects" } }] }));
    expect(acc.toMessage().tool_calls?.[0]).toMatchObject({ id: "call_0_list_projects", function: { arguments: "{}" } });
  });

  it("falha com a mensagem do provedor quando o stream traz um erro", () => {
    expect(() => new MessageAccumulator().push(JSON.stringify({ error: { message: "sem saldo" } }))).toThrow("sem saldo");
  });

  it("ignora chunks sem choices (ex.: uso de tokens)", () => {
    expect(new MessageAccumulator().push(JSON.stringify({ usage: { total_tokens: 3 } }))).toEqual({});
  });
});

describe("danglingToolCalls", () => {
  const call = (id: string) => ({ id, type: "function" as const, function: { name: "delete_skill", arguments: "{}" } });

  it("acha chamadas do último turno do assistente sem resposta", () => {
    const messages: HistoryMessage[] = [
      { role: "user", content: "apague" },
      { role: "assistant", content: null, tool_calls: [call("a"), call("b")] },
      { role: "tool", tool_call_id: "a", content: "ok" },
    ];
    expect(danglingToolCalls(messages).map((c) => c.id)).toEqual(["b"]);
  });

  it("não devolve nada quando tudo foi respondido ou o último é do usuário", () => {
    expect(danglingToolCalls([{ role: "user", content: "oi" }])).toEqual([]);
    expect(
      danglingToolCalls([
        { role: "assistant", content: null, tool_calls: [call("a")] },
        { role: "tool", tool_call_id: "a", content: "ok" },
      ]),
    ).toEqual([]);
  });
});
