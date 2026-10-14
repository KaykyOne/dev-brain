import { describe, expect, it } from "vitest";

import { parseSkillMarkdown } from "./frontmatter";

describe("parseSkillMarkdown", () => {
  it("lê name e description do frontmatter", () => {
    const text = '---\nname: criar-endpoint\ndescription: "Use ao criar uma rota de API"\n---\n\n# Corpo';
    expect(parseSkillMarkdown(text)).toEqual({ name: "criar-endpoint", description: "Use ao criar uma rota de API" });
  });

  it("junta descrições em várias linhas", () => {
    const text = "---\nname: x\ndescription: >\n  Primeira parte\n  segunda parte\n---\nconteúdo";
    expect(parseSkillMarkdown(text).description).toBe("Primeira parte segunda parte");
  });

  it("aceita CRLF e BOM", () => {
    expect(parseSkillMarkdown("﻿---\r\nname: a\r\ndescription: b\r\n---\r\n").name).toBe("a");
  });

  it("sem frontmatter usa o primeiro título e a primeira linha de texto como descrição", () => {
    expect(parseSkillMarkdown("# Revisar código\n\nUse ao revisar diffs.\nmais")).toEqual({
      name: "Revisar código",
      description: "Use ao revisar diffs.",
    });
  });

  it("não usa títulos nem blocos de código como descrição", () => {
    expect(parseSkillMarkdown("# Só título\n## Outro").description).toBeNull();
  });

  it("retorna nulos quando não há nada aproveitável", () => {
    expect(parseSkillMarkdown("```\ncodigo\n```")).toEqual({ name: null, description: null });
  });
});
