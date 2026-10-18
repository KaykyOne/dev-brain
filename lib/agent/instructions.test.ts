import { describe, expect, it } from "vitest";

import { buildAgentsInstructions, instructionsFileName, mcpServerName, tokenEnvVar } from "./instructions";

describe("nomes", () => {
  it("usa devbrain-<slug> para projetos e devbrain para a conta", () => {
    expect(mcpServerName("televisao")).toBe("devbrain-televisao");
    expect(mcpServerName(null)).toBe("devbrain");
    expect(mcpServerName()).toBe("devbrain");
  });

  it("gera um nome de variável de ambiente válido", () => {
    expect(tokenEnvVar("tele-visao")).toBe("DEVBRAIN_TOKEN_TELE_VISAO");
    expect(tokenEnvVar("loja.v2")).toBe("DEVBRAIN_TOKEN_LOJA_V2");
    expect(tokenEnvVar(null)).toBe("DEVBRAIN_TOKEN");
  });

  it("nomeia o arquivo para download", () => {
    expect(instructionsFileName("televisao")).toBe("devbrain-televisao-AGENTS.md");
  });
});

describe("buildAgentsInstructions", () => {
  const text = buildAgentsInstructions({ name: "Tele.visão", slug: "tele-visao" });

  it("aponta o servidor MCP do projeto e o torna obrigatório", () => {
    expect(text).toContain("devbrain-tele-visao");
    expect(text).toContain("OBRIGATÓRIO");
    expect(text).toContain("fonte da verdade");
  });

  it("cita só ferramentas que o servidor expõe", () => {
    for (const tool of ["read_context_file", "list_skills", "get_skill", "write_context_file", "repo_log", "propose_change"]) {
      expect(text).toContain(`\`${tool}\``);
    }
  });

  it("manda parar quando o MCP não estiver disponível", () => {
    expect(text).toMatch(/pare e avise o usuário/);
  });

  it("não deixa o nome do projeto quebrar o título", () => {
    const hostile = buildAgentsInstructions({ name: "Meu\n# Injetado `x`", slug: "x" });
    expect(hostile.split("\n")[0]).toBe("## Contexto do projeto Meu Injetado x — uso OBRIGATÓRIO do MCP `devbrain-x`");
  });

  it("não deixa marcadores sem preencher", () => {
    expect(text).not.toMatch(/\{\{|<SEU|undefined/);
  });
});
