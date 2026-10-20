import { NextResponse } from "next/server";

import { validateSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { toolDefinitions } from "@/lib/assistant/actions";
import { runAssistant, type AgentDeps } from "@/lib/assistant/agent";
import { resolveAiConfig } from "@/lib/assistant/config";
import { HANDLERS } from "@/lib/assistant/handlers";
import { LlmError, streamChat } from "@/lib/assistant/llm";
import { buildSystemPrompt } from "@/lib/assistant/prompt";
import { requestSchema, type AssistantEvent } from "@/lib/assistant/protocol";
import { createRateLimiter } from "@/lib/security/rate-limit";

const MAX_BODY_BYTES = 2_000_000;

// Cada mensagem pode disparar várias chamadas ao provedor de IA (pago): limita por usuário.
const checkRate = createRateLimiter({ limit: 30, windowMs: 60_000 });

const problem = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  const user = await validateSession();
  if (!user) return problem(401, "Sessão expirada. Entre novamente.");

  const config = resolveAiConfig(env);
  if (!config.enabled) return problem(503, config.reason);

  if (!checkRate(user.id).allowed) return problem(429, "Muitas mensagens em pouco tempo. Aguarde um instante.");

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return problem(413, "Conversa grande demais. Comece uma nova.");

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return problem(400, parsed.error.issues[0]?.message ?? "Requisição inválida.");

  const ctx = { userId: user.id };
  const deps: AgentDeps = {
    chat: (messages) => streamChat({ config, messages, tools: toolDefinitions(), signal: request.signal }),
    execute: (name, args) => HANDLERS[name].run(args as never, ctx),
    preview: async (name, args) => HANDLERS[name].preview?.(args as never, ctx),
    onError: (message, error) =>
      logger.error("assistant", message, {
        error,
        // O motivo detalhado do provedor vai só para o log, nunca para o chat.
        details: error instanceof LlmError ? { status: error.status, provider: error.detail } : undefined,
      }),
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    // O laço roda a partir daqui, dentro do contexto da requisição, para as ações enxergarem a sessão (cookies).
    start(controller) {
      const emit = (event: AssistantEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // o navegador fechou a conexão: o signal da requisição já interrompe o laço
        }
      };

      void (async () => {
        try {
          await runAssistant(
            {
              request: parsed.data,
              systemPrompt: buildSystemPrompt({ page: parsed.data.page }),
              maxSteps: config.maxSteps,
              signal: request.signal,
              emit,
            },
            deps,
          );
        } finally {
          try {
            controller.close();
          } catch {
            // já fechado
          }
        }
      })();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" },
  });
}
