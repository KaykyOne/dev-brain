import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { logger } from "@/lib/logger";

type NewNotification = {
  ownerId: string;
  projectId?: string | null;
  kind: string;
  title: string;
  body?: string;
  href?: string;
  /** Não cria outra se já houver uma não lida do mesmo tipo (e projeto): evita enxurrada de avisos repetidos. */
  dedupe?: boolean;
};

/** Cria um aviso interno. Nunca lança: uma notificação perdida não pode derrubar a operação de origem. */
export async function notify({ dedupe, ...entry }: NewNotification) {
  try {
    if (dedupe) {
      const [existing] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.ownerId, entry.ownerId),
            eq(notifications.kind, entry.kind),
            entry.projectId ? eq(notifications.projectId, entry.projectId) : isNull(notifications.projectId),
            isNull(notifications.readAt),
          ),
        )
        .limit(1);
      if (existing) return;
    }

    await db.insert(notifications).values({
      ownerId: entry.ownerId,
      projectId: entry.projectId ?? null,
      kind: entry.kind,
      title: entry.title,
      body: entry.body ?? "",
      href: entry.href ?? null,
    });
  } catch (error) {
    await logger.error("notifications", "Não foi possível criar a notificação", { error });
  }
}
