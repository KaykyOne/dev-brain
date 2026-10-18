import { describe, expect, it } from "vitest";

import { formatSelection, type Edit } from "./format";
import { splitFrontmatter } from "./split";

/** Aplica a edição ao texto, como o editor faria. */
const apply = (doc: string, edit: Edit) => doc.slice(0, edit.from) + edit.insert + doc.slice(edit.to);

describe("formatSelection", () => {
  it("envolve a seleção em negrito e mantém o texto selecionado", () => {
    const edit = formatSelection("um texto aqui", 3, 8, "bold");
    expect(apply("um texto aqui", edit)).toBe("um **texto** aqui");
    expect("um **texto** aqui".slice(edit.anchor, edit.head)).toBe("texto");
  });

  it("insere um placeholder selecionado quando não há seleção", () => {
    const edit = formatSelection("", 0, 0, "italic");
    expect(apply("", edit)).toBe("_itálico_");
    expect("_itálico_".slice(edit.anchor, edit.head)).toBe("itálico");
  });

  it("cria link deixando a URL selecionada", () => {
    const edit = formatSelection("ver docs", 4, 8, "link");
    const result = apply("ver docs", edit);
    expect(result).toBe("ver [docs](https://)");
    expect(result.slice(edit.anchor, edit.head)).toBe("https://");
  });

  it("aplica prefixo de lista em todas as linhas tocadas e desfaz ao repetir", () => {
    const doc = "a\nb\nc";
    const first = formatSelection(doc, 0, 5, "ul");
    expect(apply(doc, first)).toBe("- a\n- b\n- c");
    const second = formatSelection("- a\n- b\n- c", 0, 11, "ul");
    expect(apply("- a\n- b\n- c", second)).toBe("a\nb\nc");
  });

  it("numera listas ordenadas e troca o prefixo anterior", () => {
    expect(apply("a\nb", formatSelection("a\nb", 0, 3, "ol"))).toBe("1. a\n2. b");
    expect(apply("- a", formatSelection("- a", 0, 3, "heading"))).toBe("## a");
  });

  it("formata só a linha do cursor", () => {
    const doc = "primeira\nsegunda\nterceira";
    expect(apply(doc, formatSelection(doc, 10, 10, "quote"))).toBe("primeira\n> segunda\nterceira");
  });

  it("cria bloco de código", () => {
    expect(apply("x", formatSelection("x", 0, 1, "codeblock"))).toBe("```\nx\n```");
  });
});

describe("splitFrontmatter", () => {
  it("separa o frontmatter do corpo", () => {
    expect(splitFrontmatter("---\nname: a\n---\n# Corpo")).toEqual({ frontmatter: "name: a", body: "# Corpo" });
  });

  it("devolve o texto todo quando não há frontmatter", () => {
    expect(splitFrontmatter("# Só corpo")).toEqual({ frontmatter: null, body: "# Só corpo" });
  });

  it("aceita CRLF", () => {
    expect(splitFrontmatter("---\r\nname: a\r\n---\r\ncorpo").frontmatter).toBe("name: a");
  });
});
