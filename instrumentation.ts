import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startup } = await import("./lib/startup");
  await startup();
}

/** Erros não tratados de renderização, route handlers e server actions vão para a página Logs. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { logger } = await import("./lib/logger");
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;

  await logger.error("request", `Erro em ${request.method} ${request.path.split("?")[0]}`, {
    error,
    details: { digest, route: context.routePath, tipo: context.routeType, origem: context.renderSource },
  });
};
