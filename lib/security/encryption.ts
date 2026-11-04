import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/**
 * Criptografia simétrica (AES-256-GCM) para segredos que o painel precisa mostrar de novo, como a chave do MCP.
 * O banco guarda só o texto cifrado: um dump do Postgres sozinho não revela nada.
 */

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

export class EncryptionError extends Error {}

/** Formato: `v1.<iv>.<tag>.<cifrado>`, cada parte em base64url. */
export function encryptWithKey(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), encrypted].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
}

export function decryptWithKey(payload: string, key: Buffer): string {
  const [version, iv, tag, encrypted] = payload.split(".");
  if (version !== VERSION || !iv || !tag || encrypted === undefined) throw new EncryptionError("Formato de segredo desconhecido");

  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    // Chave trocada ou conteúdo adulterado: o GCM recusa em vez de devolver lixo.
    throw new EncryptionError("Não foi possível decifrar o segredo");
  }
}

/** Lê uma chave em base64 (32 bytes). */
export function parseKey(value: string): Buffer {
  const key = Buffer.from(value.trim(), "base64");
  if (key.length !== 32) throw new EncryptionError("A chave de criptografia deve ter 32 bytes em base64");
  return key;
}

/**
 * Chave do app: a de `TOKEN_ENCRYPTION_KEY` se definida; senão, uma gerada na primeira vez e guardada em
 * `<dir>/.secrets/token.key` (no Docker, o volume dos repositórios), legível só pelo usuário do processo.
 */
export async function loadOrCreateKey(options: { envValue?: string; dir: string }): Promise<Buffer> {
  if (options.envValue) return parseKey(options.envValue);

  const file = join(resolve(options.dir), ".secrets", "token.key");
  try {
    return parseKey(await readFile(file, "utf8"));
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }

  const key = randomBytes(32);
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  try {
    // `wx`: se outro processo criou a chave ao mesmo tempo, vale a dele.
    await writeFile(file, key.toString("base64"), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as { code?: string }).code === "EEXIST") return parseKey(await readFile(file, "utf8"));
    throw error;
  }
  await chmod(file, 0o600);
  return key;
}
