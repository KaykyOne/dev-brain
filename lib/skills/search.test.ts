import { describe, expect, it } from "vitest";

import { findRanges, highlightSegments, matchSkill } from "./search";

describe("findRanges", () => {
  it("ignora maiúsculas e acentos", () => {
    expect(findRanges("Criar Migração de banco", "migracao")).toEqual([[6, 14]]);
    expect(findRanges("ação AÇÃO", "acao")).toEqual([
      [0, 4],
      [5, 9],
    ]);
  });

  it("aceita busca com acento em texto sem acento", () => {
    expect(findRanges("revisar codigo", "código")).toEqual([[8, 14]]);
  });

  it("devolve vazio para busca vazia ou sem acerto", () => {
    expect(findRanges("texto", "")).toEqual([]);
    expect(findRanges("texto", "   ")).toEqual([]);
    expect(findRanges("texto", "xyz")).toEqual([]);
  });

  it("encontra várias ocorrências sem sobrepor", () => {
    expect(findRanges("aaaa", "aa")).toEqual([
      [0, 2],
      [2, 4],
    ]);
  });

  it("mantém as posições corretas com acentos decompostos (NFD)", () => {
    const decomposed = "café bom"; // "café" com o acento como caractere separado
    const [[start, end]] = findRanges(decomposed, "bom");
    expect(decomposed.slice(start, end)).toBe("bom");
  });
});

describe("highlightSegments", () => {
  it("separa os trechos marcados", () => {
    expect(highlightSegments("Criar endpoint REST", "endpoint")).toEqual([
      { text: "Criar ", match: false },
      { text: "endpoint", match: true },
      { text: " REST", match: false },
    ]);
  });

  it("devolve o texto inteiro sem marcar quando não há busca", () => {
    expect(highlightSegments("abc", "")).toEqual([{ text: "abc", match: false }]);
  });

  it("preserva o texto original (com acentos) nos trechos", () => {
    const segments = highlightSegments("Migração", "migracao");
    expect(segments).toEqual([{ text: "Migração", match: true }]);
  });
});

describe("matchSkill", () => {
  const skill = { name: "Criar migration", description: "Use ao alterar o schema", content: "# Passos\nrodar drizzle-kit" };

  it("indica onde acertou", () => {
    expect(matchSkill(skill, "migration")).toMatchObject({ name: true, description: false, content: false, any: true });
    expect(matchSkill(skill, "schema")).toMatchObject({ name: false, description: true, content: false, any: true });
    expect(matchSkill(skill, "drizzle")).toMatchObject({ name: false, description: false, content: true, any: true });
  });

  it("considera o nome do projeto", () => {
    expect(matchSkill(skill, "loja", "Loja Exemplo")).toMatchObject({ project: true, any: true });
    expect(matchSkill(skill, "loja")).toMatchObject({ project: false, any: false });
  });

  it("não quebra sem conteúdo", () => {
    expect(matchSkill({ ...skill, content: null }, "drizzle").any).toBe(false);
  });
});
