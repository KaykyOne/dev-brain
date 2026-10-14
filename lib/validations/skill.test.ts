import { describe, expect, it } from "vitest";

import { createProjectSchema } from "./project";
import { skillListSchema } from "./skill";

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
    expect(createProjectSchema.safeParse({ ...base, skills: [skill("Criar endpoint")] }).success).toBe(true);
  });
});
