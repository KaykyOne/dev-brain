import { describe, expect, it } from "vitest";

import { projectSchema } from "./project";

const valid = {
  name: "Meu Projeto",
  slug: "meu-projeto",
  description: "",
  repositoryPath: "devbrain/projects/meu-projeto",
  defaultBranch: "main",
};

describe("projectSchema", () => {
  it("aceita dados válidos", () => {
    expect(projectSchema.safeParse(valid).success).toBe(true);
  });

  it("aceita caminho vazio (repositório ainda não vinculado)", () => {
    expect(projectSchema.safeParse({ ...valid, repositoryPath: "" }).success).toBe(true);
  });

  it.each([
    { slug: "Meu Projeto" },
    { slug: "a" },
    { repositoryPath: "../fora" },
    { repositoryPath: "/absoluto" },
    { defaultBranch: "main..x" },
    { name: "   " },
  ])("rejeita %j", (override) => {
    expect(projectSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});
