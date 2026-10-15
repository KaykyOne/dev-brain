import { describe, expect, it } from "vitest";

import { changePasswordSchema } from "./auth";

const valid = { currentPassword: "Senha123?", newPassword: "NovaSenha456!", confirmPassword: "NovaSenha456!" };

describe("changePasswordSchema", () => {
  it("aceita troca válida", () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    [{ newPassword: "curta", confirmPassword: "curta" }, "newPassword"],
    [{ confirmPassword: "diferente123" }, "confirmPassword"],
    [{ newPassword: "Senha123?", confirmPassword: "Senha123?" }, "newPassword"],
    [{ currentPassword: "" }, "currentPassword"],
  ])("rejeita %j", (override, field) => {
    const result = changePasswordSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toContain(field);
  });
});
