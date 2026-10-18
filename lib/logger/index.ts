import { lt } from "drizzle-orm";

import { db } from "@/db";
import { appLogs } from "@/db/schema";

import { MAX_MESSAGE, MAX_STACK, redact, serializeError, toDetails, truncate } from "./format";

type Level = "info" | "warn" | "error";
type Options = { error?: unknown; details?: Record<string, unknown> };

export const LOG_RETENTION_DAYS = 30;

async function write(level: Level, scope: string, message: string, options: Options = {}) {
  try {
    const failure = options.error === undefined ? null : serializeError(options.error);
    const text = truncate(redact(failure ? `${message}: ${failure.message}` : message), MAX_MESSAGE);

    // Também no stdout, para `docker logs`.
    (level === "info" ? console.log : level === "warn" ? console.warn : console.error)(`[${scope}] ${text}`);

    await db.insert(appLogs).values({
      level,
      scope,
      message: text,
      details: toDetails({ ...failure?.details, ...options.details }),
      stack: failure?.stack ? truncate(redact(failure.stack), MAX_STACK) : null,
    });
  } catch (loggingError) {
    // Registrar log nunca pode derrubar a operação que está sendo registrada.
    console.error("[logger] não foi possível gravar o log no banco", loggingError);
  }
}

export const logger = {
  info: (scope: string, message: string, options?: Options) => write("info", scope, message, options),
  warn: (scope: string, message: string, options?: Options) => write("warn", scope, message, options),
  error: (scope: string, message: string, options?: Options) => write("error", scope, message, options),
};

/** Apaga logs mais antigos que o período de retenção. */
export async function pruneLogs(days = LOG_RETENTION_DAYS) {
  const limit = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  await db.delete(appLogs).where(lt(appLogs.createdAt, limit));
}
