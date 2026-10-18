import { z } from "zod";

export const LOG_LEVELS = ["error", "warn", "info"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Parâmetros de URL da página de logs; valores inválidos são ignorados em vez de gerar erro. */
export const logsSearchSchema = z.object({
  level: z.enum(LOG_LEVELS).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type LogsSearch = z.infer<typeof logsSearchSchema>;
