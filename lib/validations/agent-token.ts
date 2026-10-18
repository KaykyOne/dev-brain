import { z } from "zod";

import { ACCOUNT_SCOPES, AGENT_SCOPE_KEYS, PROJECT_SCOPES } from "@/lib/agent/scopes";

/** Valor do seletor de projeto que gera um token de conta (hub). */
export const ACCOUNT_TARGET = "account";

export const EXPIRATION_OPTIONS = {
  never: "Sem expiração",
  "30": "30 dias",
  "90": "90 dias",
  "365": "1 ano",
} as const;

export const agentTokenSchema = z
  .object({
    name: z.string().trim().min(1, "Informe um nome").max(60, "Máximo de 60 caracteres"),
    projectId: z.union([z.literal(ACCOUNT_TARGET), z.uuid("Selecione um projeto")]),
    scopes: z.array(z.enum(AGENT_SCOPE_KEYS)).min(1, "Selecione ao menos um escopo"),
    expiration: z.enum(
      Object.keys(EXPIRATION_OPTIONS) as [keyof typeof EXPIRATION_OPTIONS, ...(keyof typeof EXPIRATION_OPTIONS)[]],
    ),
  })
  .superRefine((value, context) => {
    const allowed = value.projectId === ACCOUNT_TARGET ? ACCOUNT_SCOPES : PROJECT_SCOPES;
    if (value.scopes.some((scope) => !allowed.includes(scope))) {
      context.addIssue({
        code: "custom",
        path: ["scopes"],
        message:
          value.projectId === ACCOUNT_TARGET
            ? "Token de conta aceita apenas o escopo projects:create"
            : "Escopo não permitido para token de projeto",
      });
    }
  });

export type AgentTokenInput = z.infer<typeof agentTokenSchema>;
