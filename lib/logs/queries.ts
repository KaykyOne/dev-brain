import "server-only";

import { and, count, desc, eq, ilike, or } from "drizzle-orm";

import { db } from "@/db";
import { appLogs } from "@/db/schema";
import type { LogsSearch } from "@/lib/validations/logs";

const LOGS_PAGE_SIZE = 50;

/** Escapa os curingas do LIKE para que a busca seja literal. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

export async function listLogs({ level, q, page }: LogsSearch) {
  const pattern = q ? `%${escapeLike(q)}%` : null;
  const where = and(
    level ? eq(appLogs.level, level) : undefined,
    pattern ? or(ilike(appLogs.message, pattern), ilike(appLogs.scope, pattern)) : undefined,
  );

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(appLogs)
      .where(where)
      .orderBy(desc(appLogs.createdAt))
      .limit(LOGS_PAGE_SIZE)
      .offset((page - 1) * LOGS_PAGE_SIZE),
    db.select({ total: count() }).from(appLogs).where(where),
  ]);

  return { rows, total, pages: Math.max(1, Math.ceil(total / LOGS_PAGE_SIZE)) };
}
