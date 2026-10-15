import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";

// Checagem otimista (só presença do cookie) para proteger /dashboard e demais rotas privadas.
// A validação real acontece no DAL. Não redireciona /login por causa do cookie: um cookie
// obsoleto (sessão expirada ou removida) causaria um loop /dashboard ↔ /login.
export function proxy(request: NextRequest) {
  if (!request.cookies.has(env.SESSION_COOKIE_NAME)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/skills/:path*", "/mcp/:path*", "/profile/:path*"],
};
