import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { validateSession } from "./session";

/** Usuário da sessão atual, deduplicado por request. Redireciona para /login se não houver. */
export const getCurrentUser = cache(async () => {
  const user = await validateSession();
  if (!user) redirect("/login");
  return user;
});
