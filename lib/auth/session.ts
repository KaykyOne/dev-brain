import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { env } from "@/lib/env";

const MAX_AGE_SECONDS = env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000);

  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });

  (await cookies()).set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function validateSession() {
  const token = (await cookies()).get(env.SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      user: { id: users.id, name: users.name, email: users.email },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, hashToken(token)))
    .limit(1);

  if (!row) return null;

  if (row.expiresAt <= new Date()) {
    await db.delete(sessions).where(eq(sessions.id, row.sessionId));
    return null;
  }

  return row.user;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;

  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  cookieStore.delete(env.SESSION_COOKIE_NAME);
}
