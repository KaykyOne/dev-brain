import { z } from "zod";

import { AGENT_SCOPE_KEYS } from "@/lib/agent/scopes";

export const EXPIRATION_OPTIONS = {
  never: "Sem expiração",
  "30": "30 dias",
  "90": "90 dias",
  "365": "1 ano",
} as const;

export const agentTokenSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome").max(60, "Máximo de 60 caracteres"),
  projectId: z.uuid("Selecione um projeto"),
  scopes: z.array(z.enum(AGENT_SCOPE_KEYS)).min(1, "Selecione ao menos um escopo"),
  expiration: z.enum(Object.keys(EXPIRATION_OPTIONS) as [keyof typeof EXPIRATION_OPTIONS, ...(keyof typeof EXPIRATION_OPTIONS)[]]),
});

export type AgentTokenInput = z.infer<typeof agentTokenSchema>;
