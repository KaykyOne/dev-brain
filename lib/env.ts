import { z } from "zod";

/** Variável vazia (ex.: `AI_API_KEY=` no .env) conta como não definida. */
const optional = <T extends z.ZodType>(schema: T) => z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

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
  // Pasta onde ficam os repositórios git de contexto (um por projeto). Em produção, aponte para um volume.
  CONTEXT_REPOS_DIR: z.string().min(1).default("./data/context-repos"),
  // Assistente de IA (chat no canto da tela). Pré-configurado para o DeepSeek Flash: basta definir AI_API_KEY.
  // Sem AI_API_KEY o assistente fica desativado. A chave nunca vai para o navegador.
  AI_PROVIDER: z.enum(["deepseek", "openai", "openrouter", "custom"]).default("deepseek"),
  AI_API_KEY: optional(z.string().min(1)),
  // Padrão por provedor: deepseek-flash. Nos demais, é obrigatório.
  AI_MODEL: optional(z.string().min(1)),
  // Só para AI_PROVIDER=custom (ou para sobrescrever a URL do provedor). Protocolo compatível com a API da OpenAI.
  AI_BASE_URL: optional(z.url()),
  // Modo de raciocínio do DeepSeek: mais lento e caro. Só vale para AI_PROVIDER=deepseek.
  AI_THINKING: z.enum(["enabled", "disabled"]).default("disabled"),
  // Máximo de rodadas de ferramentas por mensagem, para evitar laços.
  AI_MAX_STEPS: z.coerce.number().int().min(1).max(30).default(12),
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
