import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  // URL pública do app, incluindo o prefixo se houver (ex.: https://vps.kayky.dev.br/ai). Usada nos snippets de MCP.
  APP_URL: z
    .url()
    .default("http://localhost:3000")
    .transform((url) => url.replace(/\/+$/, "")),
  // Usuário único criado na inicialização, se ainda não existir. A senha só vale para a criação:
  // troque-a no perfil após o primeiro acesso.
  ADMIN_EMAIL: z.email().default("kaykyzioti@gmail.com"),
  ADMIN_NAME: z.string().min(1).default("Kayky Zioti"),
  ADMIN_INITIAL_PASSWORD: z.string().min(8).default("Senha123?"),
  SESSION_COOKIE_NAME: z.string().min(1).default("session"),
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().positive().default(7),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variáveis de ambiente inválidas:");
  console.error(z.prettifyError(parsed.error));
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;

/**
 * Prefixo de caminho derivado de APP_URL (ex.: "/ai" para https://vps.kayky.dev.br/ai; "" na raiz).
 * É a única fonte do basePath: next.config.ts, fetch do cliente e links absolutos partem daqui.
 */
export const basePath = new URL(env.APP_URL).pathname.replace(/\/+$/, "");
