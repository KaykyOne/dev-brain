import "server-only";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { decryptWithKey, encryptWithKey, loadOrCreateKey } from "@/lib/security/encryption";

// Chave dos segredos que o app guarda cifrados (chave do MCP, chave de API da IA). Carregada uma vez por processo;
// uma falha não fica presa no cache.
let key: Promise<Buffer> | null = null;

function appKey() {
  key ??= loadOrCreateKey({ envValue: env.TOKEN_ENCRYPTION_KEY, dir: env.CONTEXT_REPOS_DIR }).catch((error) => {
    key = null;
    throw error;
  });
  return key;
}

export async function encryptSecret(plain: string) {
  return encryptWithKey(plain, await appKey());
}

/** Segredo em claro, ou null se não puder ser decifrado (ex.: a chave de criptografia mudou). */
export async function decryptSecret(ciphertext: string, label = "segredo"): Promise<string | null> {
  try {
    return decryptWithKey(ciphertext, await appKey());
  } catch (error) {
    await logger.warn("security", `Não foi possível decifrar: ${label}`, { error });
    return null;
  }
}
