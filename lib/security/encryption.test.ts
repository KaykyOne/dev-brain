import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { decryptWithKey, encryptWithKey, EncryptionError, loadOrCreateKey, parseKey } from "./encryption";

describe("encryptWithKey / decryptWithKey", () => {
  const key = randomBytes(32);

  it("decifra o que cifrou, com IV novo a cada vez", () => {
    const a = encryptWithKey("dvb_segredo", key);
    const b = encryptWithKey("dvb_segredo", key);

    expect(a).not.toBe(b);
    expect(a).not.toContain("dvb_segredo");
    expect(decryptWithKey(a, key)).toBe("dvb_segredo");
  });

  it("recusa outra chave e conteúdo adulterado", () => {
    const payload = encryptWithKey("dvb_segredo", key);
    expect(() => decryptWithKey(payload, randomBytes(32))).toThrow(EncryptionError);

    const [version, iv, tag, data] = payload.split(".");
    const tampered = [version, iv, tag, Buffer.from("outra coisa").toString("base64url") + data].join(".");
    expect(() => decryptWithKey(tampered, key)).toThrow(EncryptionError);
  });

  it("recusa formato desconhecido", () => {
    expect(() => decryptWithKey("texto-puro", key)).toThrow(EncryptionError);
  });
});

describe("parseKey", () => {
  it("exige 32 bytes em base64", () => {
    expect(parseKey(randomBytes(32).toString("base64")).length).toBe(32);
    expect(() => parseKey(randomBytes(16).toString("base64"))).toThrow(EncryptionError);
  });
});

describe("loadOrCreateKey", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "devbrain-key-"));
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it("usa a variável de ambiente quando definida", async () => {
    const value = randomBytes(32).toString("base64");
    expect((await loadOrCreateKey({ envValue: value, dir })).equals(Buffer.from(value, "base64"))).toBe(true);
  });

  it("gera a chave uma vez, protegida, e a reaproveita", async () => {
    const first = await loadOrCreateKey({ dir });
    const second = await loadOrCreateKey({ dir });
    const file = join(dir, ".secrets", "token.key");

    expect(first.equals(second)).toBe(true);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(parseKey(await readFile(file, "utf8")).equals(first)).toBe(true);
  });

  it("falha em vez de sobrescrever uma chave inválida", async () => {
    const other = await mkdtemp(join(tmpdir(), "devbrain-key-"));
    await loadOrCreateKey({ dir: other });
    await writeFile(join(other, ".secrets", "token.key"), "curta");

    await expect(loadOrCreateKey({ dir: other })).rejects.toThrow(EncryptionError);
    await rm(other, { recursive: true, force: true });
  });
});
