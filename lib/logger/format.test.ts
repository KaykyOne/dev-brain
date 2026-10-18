import { describe, expect, it } from "vitest";

import { redact, serializeError, toDetails } from "./format";

describe("redact", () => {
  it("remove tokens e senhas", () => {
    expect(redact(`token dvb_${"A".repeat(40)} fim`)).toBe("token dvb_[redigido] fim");
    expect(redact("Authorization: Bearer abcdefghijklmnop.qrst")).toBe("Authorization: Bearer [redigido]");
    expect(redact("postgres://admin:senha123@db:5432/app")).toBe("postgres://admin:[redigido]@db:5432/app");
    expect(redact(`gh${"p"}_${"a".repeat(30)}`)).toBe("[token redigido]");
  });

  it("não altera texto comum", () => {
    expect(redact("EACCES: permission denied, mkdir '/app/data'")).toBe("EACCES: permission denied, mkdir '/app/data'");
  });
});

describe("serializeError", () => {
  it("extrai código, syscall e caminho de erros do Node", () => {
    const error = Object.assign(new Error("permission denied"), { code: "EACCES", syscall: "mkdir", path: "/app/data" });
    const result = serializeError(error);

    expect(result.message).toBe("permission denied");
    expect(result.details).toMatchObject({ name: "Error", code: "EACCES", syscall: "mkdir", path: "/app/data" });
    expect(result.stack).toContain("permission denied");
  });

  it("aceita valores que não são Error", () => {
    expect(serializeError("falhou")).toEqual({ message: "falhou", stack: null, details: {} });
  });

  it("inclui a causa", () => {
    expect(serializeError(new Error("externo", { cause: new Error("interno") })).details.cause).toBe("interno");
  });
});

describe("toDetails", () => {
  it("redige segredos e converte bigint", () => {
    expect(toDetails({ url: "postgres://u:segredo@h/db", n: BigInt(5) })).toEqual({ url: "postgres://u:[redigido]@h/db", n: "5" });
  });

  it("limita o tamanho", () => {
    expect(toDetails({ texto: "x".repeat(20_000) })).toMatchObject({ truncated: true });
  });

  it("não quebra com referência circular", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(toDetails(circular)).toEqual({ unserializable: true });
  });
});
