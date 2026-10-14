import { describe, expect, it } from "vitest";

import { SLUG_PATTERN, slugify } from "./slug";

describe("slugify", () => {
  it("remove acentos e normaliza separadores", () => {
    expect(slugify("  Projeto Ação  Rápida! ")).toBe("projeto-acao-rapida");
  });

  it("gera sempre um slug válido ou vazio", () => {
    expect(SLUG_PATTERN.test(slugify("A".repeat(100) + " b"))).toBe(true);
    expect(slugify("***")).toBe("");
  });
});
