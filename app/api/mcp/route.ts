import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { authenticateAgent, type AgentContext } from "@/lib/agent/auth";
import { createMcpServer } from "@/lib/agent/mcp-server";
import { notify } from "@/lib/notifications";
import { logger } from "@/lib/logger";

/** Registra cada ferramenta chamada pelo agente (inclusive as de leitura) na página Logs. */
async function logToolCalls(request: Request, context: AgentContext) {
  const body: unknown = await request.clone().json().catch(() => null);
  const messages = Array.isArray(body) ? body : [body];

  if (context.project && !context.project.active) {
    await notify({
      ownerId: context.ownerId,
      projectId: context.project.id,
      kind: "project.inactive_access",
      title: "IA tentou usar um projeto desativado",
      body: `${context.project.name}: o agente "${context.tokenName}" foi avisado para pedir a reativação.`,
      href: `/projects/${context.project.slug}?tab=settings`,
      dedupe: true,
    });
  }

  for (const message of messages) {
    const { method, params } = (message ?? {}) as { method?: unknown; params?: { name?: unknown; arguments?: Record<string, unknown> } };
    if (method !== "tools/call" || typeof params?.name !== "string") continue;

    const path = params.arguments?.path ?? params.arguments?.file_path;
    await logger.info("mcp", `Agente "${context.tokenName}" chamou ${params.name}`, {
      details: {
        ferramenta: params.name,
        token: context.tokenName,
        projeto: context.project?.slug,
        ...(typeof path === "string" ? { arquivo: path } : {}),
      },
    });
  }
}

// Servidor MCP (Streamable HTTP) sem estado: cada requisição é autenticada e atendida isoladamente.
export async function POST(request: Request) {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return auth.response;

  await logToolCalls(request, auth.context);

  const server = createMcpServer(auth.context);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}

const methodNotAllowed = () => new Response(null, { status: 405, headers: { Allow: "POST" } });

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
