import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validations/auth";

// Hash válido de uma senha qualquer: mantém o tempo de resposta igual quando o e-mail não existe.
const DUMMY_HASH = `${"00".repeat(16)}:${"00".repeat(64)}`;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", fields: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 });
  }

  await createSession(user.id);

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
}
