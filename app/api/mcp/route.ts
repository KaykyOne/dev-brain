import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { authenticateAgent } from "@/lib/agent/auth";
import { createMcpServer } from "@/lib/agent/mcp-server";

// Servidor MCP (Streamable HTTP) sem estado: cada requisição é autenticada e atendida isoladamente.
export async function POST(request: Request) {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return auth.response;

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
