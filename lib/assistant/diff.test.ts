import { describe, expect, it } from "vitest";

import { contentChange, lineDelta, textChange } from "./diff";

describe("lineDelta", () => {
  it("conta linhas adicionadas e removidas", () => {
    expect(lineDelta("a\nb\nc", "a\nc\nd\ne")).toEqual({ added: 2, removed: 1 });
  });

  it("respeita linhas repetidas", () => {
    expect(lineDelta("x\nx", "x")).toEqual({ added: 0, removed: 1 });
    expect(lineDelta("x", "x\nx")).toEqual({ added: 1, removed: 0 });
  });

  it("textos iguais não têm delta", () => {
    expect(lineDelta("a\nb", "a\nb")).toEqual({ added: 0, removed: 0 });
  });
});

describe("textChange", () => {
  it("só registra quando muda", () => {
    expect(textChange("nome", "A", "A")).toEqual([]);
    expect(textChange("nome", "A", undefined)).toEqual([]);
    expect(textChange("nome", "A", "B")).toEqual([{ field: "nome", before: "A", after: "B" }]);
  });

  it("encurta textos longos em uma linha", () => {
    const [change] = textChange("descrição", "x", `${"palavra ".repeat(40)}\nfim`);
    expect(change.after!.length).toBeLessThanOrEqual(90);
    expect(change.after).not.toContain("\n");
    expect(change.after!.endsWith("…")).toBe(true);
  });
});

describe("contentChange", () => {
  it("resume o conteúdo em linhas, sem despejar o texto", () => {
    expect(contentChange("conteúdo", "a\nb", "a\nb\nc")).toEqual([{ field: "conteúdo", before: "2 linhas", after: "3 linhas (+1)" }]);
  });

  it("trata arquivo novo como vazio antes", () => {
    expect(contentChange("arquivo", "", "# x")).toEqual([{ field: "arquivo", before: "vazio", after: "1 linhas (+1)" }]);
  });

  it("não registra quando igual", () => {
    expect(contentChange("c", "a", "a")).toEqual([]);
  });
});
