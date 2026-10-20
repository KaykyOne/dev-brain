import { describe, expect, it } from "vitest";

import { createProjectSchema } from "./project";
import { projectIdsSchema, promoteSkillSchema, skillListSchema, skillTargetSchema } from "./skill";

const skill = (name: string) => ({ name, description: "Quando usar", content: "" });

describe("skillListSchema", () => {
  it("aceita lista vazia e skills distintas", () => {
    expect(skillListSchema.safeParse([]).success).toBe(true);
    expect(skillListSchema.safeParse([skill("Criar endpoint"), skill("Gerar testes")]).success).toBe(true);
  });

  it("rejeita nomes que geram o mesmo slug", () => {
    expect(skillListSchema.safeParse([skill("Criar Endpoint"), skill("criar-endpoint")]).success).toBe(false);
  });

  it("rejeita nome sem caracteres aproveitáveis e descrição vazia", () => {
    expect(skillListSchema.safeParse([skill("***")]).success).toBe(false);
    expect(skillListSchema.safeParse([{ name: "Ok", description: " ", content: "" }]).success).toBe(false);
  });
});

describe("conteúdo do SKILL.md", () => {
  it("aceita arquivo importado até 100 KB e recusa acima disso", () => {
    expect(skillListSchema.safeParse([{ ...skill("A"), content: "x".repeat(100_000) }]).success).toBe(true);
    expect(skillListSchema.safeParse([{ ...skill("A"), content: "x".repeat(100_001) }]).success).toBe(false);
  });
});

describe("createProjectSchema", () => {
  it("exige o campo skills junto com os dados do projeto", () => {
    const base = { name: "App", slug: "app", description: "", repositoryPath: "", defaultBranch: "main" };
    expect(createProjectSchema.safeParse(base).success).toBe(false);
    expect(createProjectSchema.safeParse({ ...base, skills: [skill("Criar endpoint")], librarySkillIds: [] }).success).toBe(true);
  });

  it("aceita só ids válidos nas skills da biblioteca", () => {
    const base = { name: "App", slug: "app", description: "", repositoryPath: "", defaultBranch: "main", skills: [] };
    const id = "7f8c2f0e-6c43-4d44-9a4e-0f1d2c3b4a5e";
    expect(createProjectSchema.safeParse({ ...base, librarySkillIds: [id] }).success).toBe(true);
    expect(createProjectSchema.safeParse({ ...base, librarySkillIds: ["nao-e-id"] }).success).toBe(false);
  });
});

describe("skillTargetSchema", () => {
  it("aceita universal, biblioteca ou o id de um projeto", () => {
    expect(skillTargetSchema.safeParse("universal").success).toBe(true);
    expect(skillTargetSchema.safeParse("library").success).toBe(true);
    expect(skillTargetSchema.safeParse("7f8c2f0e-6c43-4d44-9a4e-0f1d2c3b4a5e").success).toBe(true);
  });

  it("rejeita qualquer outro valor", () => {
    expect(skillTargetSchema.safeParse("global").success).toBe(false);
    expect(skillTargetSchema.safeParse("").success).toBe(false);
  });
});

describe("promoteSkillSchema", () => {
  const base = { name: "Autodeploy", description: "Como publicar", content: "", keepOriginal: false, target: "library", projectIds: [] };

  it("aceita os dois destinos", () => {
    expect(promoteSkillSchema.safeParse(base).success).toBe(true);
    expect(promoteSkillSchema.safeParse({ ...base, target: "universal" }).success).toBe(true);
  });

  it("rejeita destino inválido (o id de um projeto não é destino de promoção)", () => {
    expect(promoteSkillSchema.safeParse({ ...base, target: "7f8c2f0e-6c43-4d44-9a4e-0f1d2c3b4a5e" }).success).toBe(false);
  });

  it("limita a seleção de projetos", () => {
    const id = "7f8c2f0e-6c43-4d44-9a4e-0f1d2c3b4a5e";
    expect(projectIdsSchema.safeParse(Array(201).fill(id)).success).toBe(false);
  });
});
