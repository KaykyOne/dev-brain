import { createHash, randomBytes } from "node:crypto";

const TOKEN_PREFIX = "dvb_";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function generateToken() {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, 8) };
}

/** Extrai o token de um header `Authorization: Bearer <token>`. */
export function parseBearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  const token = match?.[1];
  return token?.startsWith(TOKEN_PREFIX) ? token : null;
}

export type TokenState = { revokedAt: Date | null; expiresAt: Date | null };

export function evaluateToken(token: TokenState, now: Date): "ok" | "revoked" | "expired" {
  if (token.revokedAt) return "revoked";
  if (token.expiresAt && token.expiresAt <= now) return "expired";
  return "ok";
}
