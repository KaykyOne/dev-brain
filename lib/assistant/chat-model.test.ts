import { describe, expect, it } from "vitest";

import { addUserMessage, applyEvent, argBrief, awaitingIds, closeDanglingCalls, initialChat, markDenied, restoreChat, serializeChat, type ChatState } from "./chat-model";
import type { AssistantEvent } from "./protocol";

const apply = (state: ChatState, ...events: AssistantEvent[]) => events.reduce(applyEvent, state);
const call = (id: string, name = "delete_skill") => ({ id, type: "function" as const, function: { name, arguments: "{}" } });

describe("texto em streaming", () => {
  it("acumula os pedaços em uma única mensagem do assistente e a encerra ao concluir", () => {
    let state = addUserMessage(initialChat, "oi");
    state = apply(state, { type: "text", delta: "Olá" }, { type: "text", delta: ", mundo" });

    expect(state.items.at(-1)).toMatchObject({ kind: "assistant", text: "Olá, mundo", streaming: true });
    state = apply(state, { type: "history", messages: [{ role: "assistant", content: "Olá, mundo" }] }, { type: "done" });
    expect(state.items.at(-1)).toMatchObject({ streaming: false });
    expect(state.busy).toBe(false);
    expect(state.history).toEqual([{ role: "user", content: "oi" }, { role: "assistant", content: "Olá, mundo" }]);
  });

  it("guarda o raciocínio separado do texto", () => {
    const state = apply(initialChat, { type: "reasoning", delta: "pensando" }, { type: "text", delta: "resposta" });
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({ reasoning: "pensando", text: "resposta" });
  });

  it("depois de uma ferramenta, o texto seguinte vira uma nova mensagem", () => {
    const state = apply(
      initialChat,
      { type: "text", delta: "Vou criar." },
      { type: "tool_call", id: "t1", name: "create_skill", args: {}, needsConfirm: false },
      { type: "text", delta: "Pronto." },
    );
    expect(state.items.map((item) => item.kind)).toEqual(["assistant", "tool", "assistant"]);
  });
});

describe("passos de ferramenta", () => {
  it("vai de executando a concluído, com mudanças e links", () => {
    let state = apply(initialChat, { type: "tool_call", id: "t1", name: "update_skill", args: { slug: "a" }, needsConfirm: false });
    expect(state.items[0]).toMatchObject({ status: "running" });

    state = apply(state, { type: "tool_result", id: "t1", name: "update_skill", ok: true, summary: "Atualizada", changes: [{ field: "nome", before: "A", after: "B" }], links: [{ label: "Abrir", href: "/skills" }], mutated: true });
    expect(state.items[0]).toMatchObject({ status: "done", summary: "Atualizada", changes: [{ field: "nome" }], links: [{ href: "/skills" }] });
  });

  it("falha vira status de erro", () => {
    const state = apply(
      initialChat,
      { type: "tool_call", id: "t1", name: "get_skill", args: {}, needsConfirm: false },
      { type: "tool_result", id: "t1", name: "get_skill", ok: false, summary: "não encontrada", mutated: false },
    );
    expect(state.items[0]).toMatchObject({ status: "error", summary: "não encontrada" });
  });

  it("repetir tool_call do mesmo id (retomada após aprovar) atualiza o mesmo passo", () => {
    let state = apply(initialChat, { type: "tool_call", id: "d1", name: "delete_skill", args: {}, needsConfirm: true }, { type: "confirm", id: "d1", name: "delete_skill", args: {}, summary: "Remover X" });
    expect(state.items[0]).toMatchObject({ status: "awaiting", confirmSummary: "Remover X" });
    expect(awaitingIds(state)).toEqual(["d1"]);

    state = apply(state, { type: "tool_call", id: "d1", name: "delete_skill", args: {}, needsConfirm: true });
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({ status: "running" });
  });

  it("uma recusa do usuário continua 'recusada' mesmo com o resultado de erro do servidor", () => {
    let state = apply(initialChat, { type: "tool_call", id: "d1", name: "delete_skill", args: {}, needsConfirm: true }, { type: "confirm", id: "d1", name: "delete_skill", args: {} });
    state = markDenied(state, "d1");
    state = apply(state, { type: "tool_result", id: "d1", name: "delete_skill", ok: false, summary: "O usuário recusou", mutated: false });
    expect(state.items[0]).toMatchObject({ status: "denied" });
  });
});

describe("erros", () => {
  it("mostra o erro e libera o campo de envio", () => {
    const state = apply({ ...initialChat, busy: true }, { type: "error", message: "Chave recusada" });
    expect(state.busy).toBe(false);
    expect(state.items.at(-1)).toMatchObject({ kind: "error", text: "Chave recusada" });
  });
});

describe("chamadas sem resposta", () => {
  const pending: ChatState = {
    busy: false,
    items: [{ kind: "tool", id: "d1", name: "delete_skill", args: {}, status: "awaiting" }],
    history: [{ role: "user", content: "apague" }, { role: "assistant", content: null, tool_calls: [call("d1")] }],
  };

  it("fecha com uma resposta 'não executada' para cada chamada pendente", () => {
    const closed = closeDanglingCalls(pending);

    expect(closed.history.at(-1)).toMatchObject({ role: "tool", tool_call_id: "d1" });
    expect((closed.history.at(-1) as { content: string }).content).toContain("NÃO foi executada");
    expect(closed.items[0]).toMatchObject({ status: "denied" });
  });

  it("não altera nada quando não há pendência", () => {
    const state = addUserMessage(initialChat, "oi");
    expect(closeDanglingCalls(state)).toBe(state);
  });
});

describe("persistência na sessão", () => {
  it("serializa e restaura a conversa", () => {
    const state = apply(addUserMessage(initialChat, "oi"), { type: "text", delta: "olá" }, { type: "history", messages: [{ role: "assistant", content: "olá" }] }, { type: "done" });
    const restored = restoreChat(serializeChat(state));
    expect(restored.items).toEqual(state.items);
    expect(restored.history).toEqual(state.history);
    expect(restored.busy).toBe(false);
  });

  it("um passo que estava executando ao recarregar vira interrompido, e confirmações pendentes são fechadas", () => {
    const state: ChatState = {
      busy: true,
      items: [{ kind: "tool", id: "t1", name: "create_skill", args: {}, status: "running" }, { kind: "tool", id: "d1", name: "delete_skill", args: {}, status: "awaiting" }],
      history: [{ role: "user", content: "x" }, { role: "assistant", content: null, tool_calls: [call("t1", "create_skill"), call("d1")] }],
    };
    const restored = restoreChat(serializeChat(state));
    expect(restored.items[0]).toMatchObject({ status: "error", summary: "Interrompido" });
    expect(restored.items[1]).toMatchObject({ status: "denied" });
    expect(restored.history.filter((message) => message.role === "tool")).toHaveLength(2);
  });

  it("ignora dados corrompidos", () => {
    expect(restoreChat("{não é json")).toEqual(initialChat);
    expect(restoreChat(JSON.stringify({ items: 1 }))).toEqual(initialChat);
    expect(restoreChat(null)).toEqual(initialChat);
  });
});

describe("argBrief", () => {
  it("escolhe o alvo mais útil e encurta", () => {
    expect(argBrief({ name: "Autodeploy", slug: "x" })).toBe("Autodeploy");
    expect(argBrief({ slug: "tele-visao" })).toBe("tele-visao");
    expect(argBrief({ query: "a".repeat(80) }).length).toBe(48);
    expect(argBrief({})).toBe("");
    expect(argBrief("texto")).toBe("");
  });
});
