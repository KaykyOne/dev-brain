import { redirect } from "next/navigation";

import { validateSession } from "@/lib/auth/session";

/** Quem já tem sessão válida vai direto ao dashboard. Com cookie obsoleto, mostra o login normalmente. */
export async function RedirectIfAuthenticated() {
  if (await validateSession()) redirect("/dashboard");
  return null;
}
