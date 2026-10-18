import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { env } from "@/lib/env";

import { hashPassword } from "./password";

/** Cria o usuário único na inicialização, se ele ainda não existir. Devolve `true` se criou; se existir, não altera nada. */
export async function ensureAdminUser(): Promise<boolean> {
  const email = env.ADMIN_EMAIL.toLowerCase();

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return false;

  await db
    .insert(users)
    .values({ name: env.ADMIN_NAME, email, passwordHash: await hashPassword(env.ADMIN_INITIAL_PASSWORD) })
    .onConflictDoNothing({ target: users.email });

  return true;
}
