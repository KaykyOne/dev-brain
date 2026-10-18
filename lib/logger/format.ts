// Funções puras de formatação e redação de logs (sem acesso ao banco).

export const MAX_MESSAGE = 1_000;
export const MAX_STACK = 8_000;
const MAX_DETAILS = 8_000;

const REDACTIONS: [RegExp, string][] = [
  [/\bdvb_[A-Za-z0-9_-]{10,}/g, "dvb_[redigido]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{10,}/gi, "Bearer [redigido]"],
  [/\b(gh[pousr]_|github_pat_|sk-)[A-Za-z0-9_-]{16,}/g, "[token redigido]"],
  [/(\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:)[^\s/@]+(@)/gi, "$1[redigido]$2"],
];

/** Remove tokens e senhas de um texto antes de ele ser registrado. */
export function redact(text: string): string {
  return REDACTIONS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

export const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}… [truncado]` : text);

type SerializedError = { message: string; stack: string | null; details: Record<string, unknown> };

/** Extrai de um erro o que ajuda a diagnosticar (código, caminho, causa), sem depender do tipo lançado. */
export function serializeError(error: unknown): SerializedError {
  if (!(error instanceof Error)) return { message: String(error), stack: null, details: {} };

  const extra = error as Error & { code?: unknown; errno?: unknown; syscall?: unknown; path?: unknown; digest?: unknown };
  const details: Record<string, unknown> = { name: error.name };
  for (const key of ["code", "errno", "syscall", "path", "digest"] as const) {
    if (extra[key] !== undefined) details[key] = extra[key];
  }
  if (error.cause) details.cause = error.cause instanceof Error ? serializeError(error.cause).message : String(error.cause);

  return { message: error.message, stack: error.stack ?? null, details };
}

/** Garante JSON serializável, sem segredos e dentro do limite de tamanho. */
export function toDetails(details: Record<string, unknown>): Record<string, unknown> {
  try {
    const text = redact(JSON.stringify(details, (_key, value) => (typeof value === "bigint" ? value.toString() : value)));
    if (text.length <= MAX_DETAILS) return JSON.parse(text);
    return { truncated: true, preview: text.slice(0, MAX_DETAILS) };
  } catch {
    return { unserializable: true };
  }
}
