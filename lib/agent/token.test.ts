import { describe, expect, it } from "vitest";

import { evaluateToken, generateToken, hashToken, parseBearerToken } from "./token";

describe("generateToken", () => {
  it("gera token único com hash e prefixo consistentes", () => {
    const a = generateToken();
    const b = generateToken();

    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(hashToken(a.token));
    expect(a.hash).not.toContain(a.token);
    expect(a.token.startsWith(a.prefix)).toBe(true);
  });
});

describe("parseBearerToken", () => {
  it("extrai somente tokens no formato do DevBrain", () => {
    expect(parseBearerToken("Bearer dvb_abc")).toBe("dvb_abc");
    expect(parseBearerToken("bearer dvb_abc")).toBe("dvb_abc");
    expect(parseBearerToken("Bearer outro_abc")).toBeNull();
    expect(parseBearerToken("Basic dvb_abc")).toBeNull();
    expect(parseBearerToken(null)).toBeNull();
  });
});

describe("evaluateToken", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  it("aceita token ativo, sem expiração ou ainda válido", () => {
    expect(evaluateToken({ revokedAt: null, expiresAt: null }, now)).toBe("ok");
    expect(evaluateToken({ revokedAt: null, expiresAt: new Date("2026-02-01") }, now)).toBe("ok");
  });

  it("rejeita token revogado ou expirado", () => {
    expect(evaluateToken({ revokedAt: new Date("2025-12-01"), expiresAt: null }, now)).toBe("revoked");
    expect(evaluateToken({ revokedAt: null, expiresAt: new Date("2025-12-31") }, now)).toBe("expired");
    expect(evaluateToken({ revokedAt: null, expiresAt: now }, now)).toBe("expired");
  });
});
