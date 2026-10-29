import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildAgentsInstructions, instructionsFileName } from "./instructions";

describe("nomes", () => {
  it("nomeia o arquivo para download", () => {
    expect(instructionsFileName("televisao")).toBe("devbrain-televisao-AGENTS.md");
  });
});

describe("buildAgentsInstructions", () => {
  const text = buildAgentsInstructions({ name: "Tele.visão", slug: "tele-visao" });

  it("aponta o MCP único e o projeto, e o torna obrigatório", () => {
    expect(text).toContain("MCP `devbrain`");
    expect(text).toContain('project: "tele-visao"');
    expect(text).not.toContain("devbrain-tele-visao");
    expect(text).toContain("OBRIGATÓRIO");
    expect(text).toContain("fonte da verdade");
  });

  it("cita só ferramentas que o servidor expõe", () => {
    for (const tool of ["read_context_file", "list_skills", "get_skill", "write_context_file", "repo_log", "propose_change"]) {
      expect(text).toContain(`\`${tool}\``);
    }
  });

  it("torna o MCP a primeira ação e exige prova de uso", () => {
    expect(text).toContain("primeira ação de toda sessão");
    expect(text).toContain("não é opcional");
    expect(text).toMatch(/liste os arquivos de contexto que você leu/);
  });

  it("manda parar quando o MCP não estiver disponível", () => {
    expect(text).toMatch(/pare e avise o usuário/);
  });

  it("não deixa o nome do projeto quebrar o título", () => {
    const hostile = buildAgentsInstructions({ name: "Meu\n# Injetado `x`", slug: "x" });
    expect(hostile.split("\n")[0]).toBe("## Contexto do projeto Meu Injetado x — uso OBRIGATÓRIO do MCP `devbrain`");
  });

  it("não deixa marcadores sem preencher", () => {
    expect(text).not.toMatch(/\{\{|<SEU|undefined/);
  });
});

describe("template raiz/AGENTS.md", () => {
  // O hub copia este arquivo para cada projeto novo. Ele precisa ser idêntico ao texto gerado na aba MCP.
  it("é o mesmo texto gerado por buildAgentsInstructions", () => {
    const template = readFileSync(join(process.cwd(), "templates/context/raiz/AGENTS.md"), "utf8");
    const rendered = template.replaceAll("{{name}}", "Tele.visão").replaceAll("{{slug}}", "tele-visao");

    expect(rendered).toBe(buildAgentsInstructions({ name: "Tele.visão", slug: "tele-visao" }));
  });

  it("não deixa marcadores desconhecidos", () => {
    const template = readFileSync(join(process.cwd(), "templates/context/raiz/AGENTS.md"), "utf8");
    expect(template.match(/\{\{(\w+)\}\}/g)?.every((marker) => ["{{name}}", "{{slug}}"].includes(marker))).toBe(true);
  });
});
