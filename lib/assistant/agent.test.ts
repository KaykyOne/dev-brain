import { describe, expect, it, vi } from "vitest";

import { runAssistant, toModelContent, type AgentDeps } from "./agent";
import type { ApiMessage, LlmEvent } from "./llm";
import type { Outcome } from "./outcome";
import type { AssistantEvent, HistoryMessage } from "./protocol";

type Script = LlmEvent[][];

const call = (id: string, name: string, args: unknown) => ({ id, type: "function" as const, function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args) } });
const says = (text: string): LlmEvent[] => [{ type: "text", delta: text }, { type: "message", message: { content: text }, finishReason: "stop" }];
const callsTools = (...calls: ReturnType<typeof call>[]): LlmEvent[] => [{ type: "message", message: { content: null, tool_calls: calls }, finishReason: "tool_calls" }];

function setup(script: Script, execute: AgentDeps["execute"] = async () => ({ ok: true, summary: "feito" })) {
  const seen: ApiMessage[][] = [];
  let turn = 0;
  const deps: AgentDeps = {
    chat: async function* (messages) {
      seen.push(messages);
      for (const event of script[Math.min(turn++, script.length - 1)]) yield event;
    },
    execute: vi.fn(execute),
    preview: vi.fn(async (name) => `prévia de ${name}`),
    onError: vi.fn(),
  };
  return { deps, seen };
}

async function run(
  deps: AgentDeps,
  request: { messages: HistoryMessage[]; decisions?: Record<string, boolean> },
  options: { maxSteps?: number; signal?: AbortSignal } = {},
) {
  const events: AssistantEvent[] = [];
  await runAssistant({ request, systemPrompt: "SISTEMA", maxSteps: options.maxSteps ?? 6, signal: options.signal, emit: (event) => events.push(event) }, deps);
  return events;
}

const user = (content: string): HistoryMessage => ({ role: "user", content });
const types = (events: AssistantEvent[]) => events.map((event) => event.type);
const historyOf = (events: AssistantEvent[]) => events.flatMap((event) => (event.type === "history" ? event.messages : []));

describe("conversa simples", () => {
  it("transmite o texto, guarda a resposta no histórico e termina", async () => {
    const { deps, seen } = setup([says("Olá!")]);
    const events = await run(deps, { messages: [user("oi")] });

    expect(types(events)).toEqual(["text", "history", "done"]);
    expect(historyOf(events)).toEqual([{ role: "assistant", content: "Olá!" }]);
    expect(seen[0][0]).toEqual({ role: "system", content: "SISTEMA" });
  });
});

describe("ferramentas", () => {
  it("executa a ação, devolve o resultado ao modelo e continua até a resposta final", async () => {
    const { deps, seen } = setup([callsTools(call("c1", "list_projects", {})), says("Você tem 2 projetos.")], async () => ({
      ok: true,
      summary: "2 projetos",
      data: { projects: [] },
      mutated: false,
    }));
    const events = await run(deps, { messages: [user("liste")] });

    expect(types(events)).toEqual(["history", "tool_call", "history", "tool_result", "text", "history", "done"]);
    expect(deps.execute).toHaveBeenCalledWith("list_projects", {});

    const secondRequest = seen[1];
    expect(secondRequest.at(-1)).toMatchObject({ role: "tool", tool_call_id: "c1" });
    expect(JSON.parse((secondRequest.at(-1) as { content: string }).content)).toMatchObject({ ok: true, summary: "2 projetos" });
  });

  it("informa mutated e as mudanças para o chat mostrar", async () => {
    const { deps } = setup([callsTools(call("c1", "update_project", { slug: "a", name: "B" })), says("ok")], async () => ({
      ok: true,
      summary: "Projeto atualizado",
      changes: [{ field: "nome", before: "A", after: "B" }],
      mutated: true,
    }));
    const result = (await run(deps, { messages: [user("renomeie")] })).find((event) => event.type === "tool_result");
    expect(result).toMatchObject({ ok: true, mutated: true, changes: [{ field: "nome", before: "A", after: "B" }] });
  });

  it("devolve erro ao modelo quando os argumentos não são JSON, sem executar nada", async () => {
    const { deps, seen } = setup([callsTools(call("c1", "get_project", "{slug:")), says("desculpe")]);
    const events = await run(deps, { messages: [user("x")] });

    expect(deps.execute).not.toHaveBeenCalled();
    expect(events.find((event) => event.type === "tool_result")).toMatchObject({ ok: false });
    expect((seen[1].at(-1) as { content: string }).content).toContain("JSON válido");
  });

  it("recusa ação desconhecida e ação com argumentos inválidos", async () => {
    const { deps, seen } = setup([callsTools(call("c1", "hackear", {}), call("c2", "get_project", { slug: "" })), says("ok")]);
    await run(deps, { messages: [user("x")] });

    expect(deps.execute).not.toHaveBeenCalled();
    const [first, second] = seen[1].slice(-2) as { content: string }[];
    expect(first.content).toContain("não existe ou está desativada");
    expect(second.content).toContain("Argumentos inválidos");
  });

  it("não vaza detalhes de uma exceção e continua a conversa", async () => {
    const { deps, seen } = setup([callsTools(call("c1", "list_projects", {})), says("não deu")], async () => {
      throw new Error("senha do banco: 123");
    });
    const events = await run(deps, { messages: [user("x")] });

    expect(deps.onError).toHaveBeenCalled();
    expect(JSON.stringify(events)).not.toContain("senha do banco");
    expect((seen[1].at(-1) as { content: string }).content).toContain("Erro interno");
    expect(types(events).at(-1)).toBe("done");
  });
});

describe("confirmação de ações destrutivas", () => {
  const destructive = callsTools(call("d1", "delete_skill", { slug: "autodeploy", scope: "library" }));

  it("pausa antes de executar e pede a decisão, com a prévia", async () => {
    const { deps } = setup([destructive, says("removida")]);
    const events = await run(deps, { messages: [user("apague")] });

    expect(deps.execute).not.toHaveBeenCalled();
    expect(events.find((event) => event.type === "confirm")).toMatchObject({ id: "d1", name: "delete_skill", summary: "prévia de delete_skill" });
    expect(types(events).slice(-2)).toEqual(["confirm", "done"]);
  });

  it("retoma e executa quando o usuário aprova", async () => {
    const first = setup([destructive]);
    const paused = historyOf(await run(first.deps, { messages: [user("apague")] }));

    const second = setup([says("Pronto, removida.")]);
    const events = await run(second.deps, { messages: [user("apague"), ...paused], decisions: { d1: true } });

    expect(second.deps.execute).toHaveBeenCalledWith("delete_skill", { slug: "autodeploy", scope: "library" });
    expect(types(events)).toContain("tool_result");
    expect(types(events).at(-1)).toBe("done");
  });

  it("não executa quando o usuário recusa, e o modelo é avisado", async () => {
    const first = setup([destructive]);
    const paused = historyOf(await run(first.deps, { messages: [user("apague")] }));

    const second = setup([says("Ok, mantive.")]);
    const events = await run(second.deps, { messages: [user("apague"), ...paused], decisions: { d1: false } });

    expect(second.deps.execute).not.toHaveBeenCalled();
    expect(second.seen[0].some((message) => message.role === "tool" && message.content.includes("recusou"))).toBe(true);
    expect(events.find((event) => event.type === "tool_result")).toMatchObject({ ok: false });
  });

  it("em lote, executa o que é seguro, pausa na destrutiva e retoma o restante depois", async () => {
    const batch = callsTools(call("a", "list_projects", {}), call("d", "delete_project", { slug: "x" }), call("b", "list_skills", {}));
    const first = setup([batch]);
    const events = await run(first.deps, { messages: [user("faça")] });

    expect(first.deps.execute).toHaveBeenCalledTimes(1);
    expect(first.deps.execute).toHaveBeenCalledWith("list_projects", {});
    expect(types(events).at(-2)).toBe("confirm");

    const second = setup([says("feito")]);
    await run(second.deps, { messages: [user("faça"), ...historyOf(events)], decisions: { d: true } });
    expect((second.deps.execute as ReturnType<typeof vi.fn>).mock.calls.map((args) => args[0])).toEqual(["delete_project", "list_skills"]);
  });

  it("a confirmação é imposta pelo servidor: uma decisão pré-aprovada de outra chamada não vale", async () => {
    const { deps } = setup([destructive, says("ok")]);
    const events = await run(deps, { messages: [user("apague")], decisions: { outra: true } });

    expect(deps.execute).not.toHaveBeenCalled();
    expect(types(events)).toContain("confirm");
  });
});

describe("limites e falhas", () => {
  it("para no limite de passos em vez de entrar em laço", async () => {
    const { deps } = setup([callsTools(call("c", "list_projects", {}))]);
    const events = await run(deps, { messages: [user("x")] }, { maxSteps: 3 });

    expect(deps.execute).toHaveBeenCalledTimes(3);
    expect(events.at(-1)).toMatchObject({ type: "error", message: expect.stringContaining("limite de 3 passos") });
  });

  it("não faz nada se já foi cancelado", async () => {
    const { deps } = setup([says("oi")]);
    const controller = new AbortController();
    controller.abort();
    expect(await run(deps, { messages: [user("x")] }, { signal: controller.signal })).toEqual([]);
  });

  it("rejeita uma conversa em estado inválido (assistente sem pendência nem pergunta)", async () => {
    const { deps } = setup([says("oi")]);
    const events = await run(deps, { messages: [user("x"), { role: "assistant", content: "resposta" }] });
    expect(events).toEqual([{ type: "error", message: expect.stringContaining("estado inválido") }]);
  });

  it("converte falha do provedor em erro legível e registra", async () => {
    const deps: AgentDeps = {
      chat: async function* () {
        throw new Error("O provedor de IA recusou a chave de API.");
      },
      execute: vi.fn(),
      onError: vi.fn(),
    };
    const events = await run(deps, { messages: [user("x")] });
    expect(events.at(-1)).toEqual({ type: "error", message: "O provedor de IA recusou a chave de API." });
    expect(deps.onError).toHaveBeenCalled();
  });

  it("trata resposta vazia do modelo", async () => {
    const { deps } = setup([[{ type: "message", message: { content: null }, finishReason: "stop" }]]);
    expect((await run(deps, { messages: [user("x")] })).at(-1)).toMatchObject({ type: "error" });
  });
});

describe("modo de raciocínio", () => {
  it("guarda o reasoning_content no histórico para devolvê-lo ao provedor", async () => {
    const { deps } = setup([[{ type: "reasoning", delta: "pensando" }, { type: "message", message: { content: "r", reasoning_content: "pensando" }, finishReason: "stop" }]]);
    const events = await run(deps, { messages: [user("x")] });
    expect(historyOf(events)[0]).toMatchObject({ role: "assistant", reasoning_content: "pensando" });
  });
});

describe("toModelContent", () => {
  it("resume o resultado e inclui os dados", () => {
    expect(JSON.parse(toModelContent({ ok: true, summary: "ok", data: { a: 1 } }))).toEqual({ ok: true, summary: "ok", data: { a: 1 } });
    expect(JSON.parse(toModelContent({ ok: false, error: "falhou" }))).toEqual({ ok: false, error: "falhou" });
  });

  it("corta resultados enormes", () => {
    const outcome: Outcome = { ok: true, summary: "grande", data: "x".repeat(200_000) };
    const parsed = JSON.parse(toModelContent(outcome));
    expect(parsed.truncated).toBe(true);
    expect(JSON.stringify(parsed).length).toBeLessThan(125_000);
  });
});
