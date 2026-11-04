import { describe, expect, it } from "vitest";

import { estimateTokens, groupSessions, summarizeUsage, type UsageCall } from "./estimate";

const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1) + minutes * 60_000);
const call = (minutes: number, responseChars: number, projectId: string | null = "p1", tokenId = "k1"): UsageCall => ({
  projectId,
  tokenId,
  responseChars,
  createdAt: at(minutes),
});

describe("estimateTokens", () => {
  it("arredonda para cima a 4 caracteres por token", () => {
    expect(estimateTokens(0)).toBe(0);
    expect(estimateTokens(1)).toBe(1);
    expect(estimateTokens(400)).toBe(100);
  });
});

describe("groupSessions", () => {
  it("junta chamadas próximas e separa depois de uma pausa longa", () => {
    const sessions = groupSessions([call(0, 100), call(10, 50), call(39, 10), call(80, 7)]);
    expect(sessions).toEqual([
      { projectId: "p1", chars: 160, calls: 3 },
      { projectId: "p1", chars: 7, calls: 1 },
    ]);
  });

  it("separa projetos e chaves diferentes, mesmo intercalados", () => {
    const sessions = groupSessions([call(0, 1, "p1"), call(1, 2, "p2"), call(2, 4, "p1"), call(3, 8, "p1", "k2")]);
    expect(sessions).toEqual([
      { projectId: "p1", chars: 5, calls: 2 },
      { projectId: "p2", chars: 2, calls: 1 },
      { projectId: "p1", chars: 8, calls: 1 },
    ]);
  });

  it("não depende da ordem de entrada", () => {
    expect(groupSessions([call(10, 2), call(0, 1)])).toEqual([{ projectId: "p1", chars: 3, calls: 2 }]);
  });
});

describe("summarizeUsage", () => {
  const full = new Map([["p1", 4000]]); // 1000 tokens

  it("compara cada sessão com o contexto inteiro", () => {
    const { overall, byProject } = summarizeUsage([call(0, 400), call(5, 400), call(120, 800)], full);

    expect(byProject.get("p1")).toEqual({
      sessions: 2,
      calls: 3,
      deliveredTokens: 400,
      fullContextTokens: 2000,
      savedTokens: 1600,
      savedRatio: 0.8,
    });
    expect(overall.savedTokens).toBe(1600);
  });

  it("nunca conta economia negativa quando o agente leu mais que o contexto", () => {
    const { overall } = summarizeUsage([call(0, 6000)], full);
    expect(overall.savedTokens).toBe(0);
    expect(overall.deliveredTokens).toBe(1500);
  });

  it("conta as ferramentas do hub como entregues, fora da comparação", () => {
    const { overall, byProject } = summarizeUsage([call(0, 400, null)], full);
    expect(overall).toMatchObject({ sessions: 0, calls: 1, deliveredTokens: 100, savedRatio: null });
    expect(byProject.size).toBe(0);
  });

  it("ignora projetos sem tamanho conhecido na comparação", () => {
    const { overall } = summarizeUsage([call(0, 400, "outro")], full);
    expect(overall).toMatchObject({ sessions: 0, deliveredTokens: 100, fullContextTokens: 0 });
  });
});
