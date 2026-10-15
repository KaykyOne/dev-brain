import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "./login-form";
import { RedirectIfAuthenticated } from "./redirect-if-authenticated";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <Suspense>
        <RedirectIfAuthenticated />
      </Suspense>
      <LoginForm />
    </main>
  );
}
