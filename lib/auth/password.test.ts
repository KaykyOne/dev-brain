import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("verifica a senha correta e rejeita a errada", async () => {
    const hash = await hashPassword("Senha123?");
    expect(await verifyPassword("Senha123?", hash)).toBe(true);
    expect(await verifyPassword("senha123?", hash)).toBe(false);
  });

  it("gera hashes diferentes para a mesma senha (salt)", async () => {
    expect(await hashPassword("x12345678")).not.toBe(await hashPassword("x12345678"));
  });

  it("rejeita hash malformado", async () => {
    expect(await verifyPassword("a", "sem-separador")).toBe(false);
  });
});
