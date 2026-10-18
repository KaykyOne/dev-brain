import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

let proxy: typeof import("./proxy").proxy;
let config: typeof import("./proxy").config;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/db");
  ({ proxy, config } = await import("./proxy"));
});

const request = (path: string, cookie?: string, basePath = "") =>
  new NextRequest(`http://localhost:3000${basePath}${path}`, {
    headers: cookie ? { cookie } : {},
    nextConfig: { basePath },
  });

describe("proxy", () => {
  it("redireciona para /login quando não há cookie de sessão", () => {
    const response = proxy(request("/dashboard"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("preserva o basePath no redirect para /login", () => {
    const response = proxy(request("/dashboard", undefined, "/ai"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/ai/login");
  });

  it("deixa passar quando há cookie (a validação real é do DAL)", () => {
    expect(proxy(request("/dashboard", "session=abc")).headers.get("location")).toBeNull();
  });

  it("protege todas as áreas privadas, incluindo /logs", () => {
    for (const area of ["dashboard", "projects", "skills", "mcp", "profile", "logs"]) {
      expect(config.matcher).toContain(`/${area}/:path*`);
    }
  });

  // Regressão: redirecionar /login por causa do cookie gerava loop com cookie obsoleto.
  it("não intercepta /login", () => {
    expect(config.matcher).not.toContain("/login");
    expect(config.matcher.some((pattern) => pattern.startsWith("/login"))).toBe(false);
  });
});
