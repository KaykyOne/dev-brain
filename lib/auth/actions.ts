"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import { fail, type ActionResult } from "@/lib/action-result";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { changePasswordSchema } from "@/lib/validations/auth";

import { getCurrentUser } from "./dal";
import { hashPassword, verifyPassword } from "./password";
import { destroyOtherSessions } from "./session";

// Limita tentativas de adivinhar a senha atual por usuário.
const checkAttempts = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });

export async function changePassword(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos", z.flattenError(parsed.error).fieldErrors);

  if (!checkAttempts(user.id).allowed) {
    return fail("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
  }

  const { currentPassword, newPassword } = parsed.data;

  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
    return fail("Dados inválidos", { currentPassword: ["Senha atual incorreta"] });
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(users.id, user.id));

  // Outros dispositivos precisam entrar de novo com a nova senha.
  await destroyOtherSessions(user.id);

  return { ok: true, data: undefined };
}
