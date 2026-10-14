import { describe, expect, it } from "vitest";

import { findSecrets } from "./secrets";

describe("findSecrets", () => {
  it("não acusa texto comum", () => {
    expect(findSecrets("# Contexto\nUsamos Postgres e Next.js. Veja https://exemplo.com/docs")).toEqual([]);
  });

  it.each([
    ["-----BEGIN RSA PRIVATE KEY-----\nabc", "chave privada"],
    [`token ghp_${"a".repeat(36)}`, "token GitHub"],
    ["AKIAABCDEFGHIJKLMNOP", "chave AWS"],
    ["postgres://admin:senha123@db.interno:5432/app", "credencial em URL"],
    [`dvb_${"A".repeat(43)}`, "token DevBrain"],
  ])("detecta %j", (text, expected) => {
    expect(findSecrets(text)).toContain(expected);
  });
});
