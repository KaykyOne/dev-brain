import { describe, expect, it } from "vitest";

import { isInsideRoot, normalizeRelativePath } from "./paths";

describe("normalizeRelativePath", () => {
  it("aceita caminhos relativos e remove a barra final", () => {
    expect(normalizeRelativePath("devbrain/projects/app/")).toBe("devbrain/projects/app");
  });

  it.each(["", "  ", "/etc/passwd", "../segredo", "a/../b", "a//b", "./a", "a\\b", "a\0b"])(
    "rejeita %j",
    (input) => {
      expect(normalizeRelativePath(input)).toBeNull();
    },
  );
});

describe("isInsideRoot", () => {
  it("restringe ao diretório raiz", () => {
    expect(isInsideRoot("devbrain/projects/a", "devbrain/projects/a/context.md")).toBe(true);
    expect(isInsideRoot("devbrain/projects/a", "devbrain/projects/a")).toBe(true);
    expect(isInsideRoot("devbrain/projects/a", "devbrain/projects/ab/context.md")).toBe(false);
    expect(isInsideRoot("devbrain/projects/a", "devbrain/global/context.md")).toBe(false);
  });
});
