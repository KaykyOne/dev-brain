import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";

// Checagem otimista (só presença do cookie). A validação real acontece no DAL.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(env.SESSION_COOKIE_NAME);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard") && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
