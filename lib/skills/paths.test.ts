import { describe, expect, it } from "vitest";

import { skillRepoPath } from "./paths";

describe("skillRepoPath", () => {
  it("usa a pasta global para skills universais", () => {
    expect(skillRepoPath({ slug: "revisar-codigo" })).toBe("devbrain/global/skills/revisar-codigo/SKILL.md");
  });

  it("usa o caminho do projeto quando vinculado ao repositório", () => {
    expect(
      skillRepoPath({ slug: "migration", project: { slug: "app", repositoryPath: "docs/ai/app" } }),
    ).toBe("docs/ai/app/skills/migration/SKILL.md");
  });

  it("cai no padrão devbrain/projects/<slug> sem caminho definido", () => {
    expect(skillRepoPath({ slug: "migration", project: { slug: "app", repositoryPath: null } })).toBe(
      "devbrain/projects/app/skills/migration/SKILL.md",
    );
  });

  it("usa a pasta da biblioteca para skills compartilhadas", () => {
    expect(skillRepoPath({ slug: "autodeploy", library: true })).toBe("devbrain/library/skills/autodeploy/SKILL.md");
  });
});
