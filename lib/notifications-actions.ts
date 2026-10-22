"use server";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";

const LIMIT = 30;

/** Últimas notificações do usuário (lidas e não lidas), usadas também no polling do sino. */
export async function listNotifications() {
  const user = await getCurrentUser();
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.ownerId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(LIMIT);
}

export async function markNotificationRead(id: string) {
  const user = await getCurrentUser();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.ownerId, user.id), isNull(notifications.readAt)));
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.ownerId, user.id), isNull(notifications.readAt)));
}
