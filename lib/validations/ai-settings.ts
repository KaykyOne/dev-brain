import { z } from "zod";

import { AI_PROVIDERS } from "@/lib/assistant/config";

const providers = Object.keys(AI_PROVIDERS) as [keyof typeof AI_PROVIDERS, ...(keyof typeof AI_PROVIDERS)[]];

export const aiSettingsSchema = z
  .object({
    provider: z.enum(providers),
    // Vazio mantém a chave salva; só é enviada quando o usuário digita uma nova.
    apiKey: z.string().trim().max(500, "Chave longa demais"),
    removeApiKey: z.boolean(),
    model: z.string().trim().max(200, "Máximo de 200 caracteres"),
    baseUrl: z.union([z.literal(""), z.url("Informe uma URL válida (https://...)").trim()]),
    thinking: z.boolean(),
    maxSteps: z.number("Informe um número").int("Use um número inteiro").min(1, "Mínimo de 1").max(30, "Máximo de 30"),
  })
  .superRefine((value, context) => {
    if (value.provider !== "deepseek" && !value.model) {
      context.addIssue({ code: "custom", path: ["model"], message: "Este provedor não tem modelo padrão: informe o modelo" });
    }
    if (value.provider === "custom" && !value.baseUrl) {
      context.addIssue({ code: "custom", path: ["baseUrl"], message: "Informe a URL da API do provedor" });
    }
    if (/\s/.test(value.apiKey)) {
      context.addIssue({ code: "custom", path: ["apiKey"], message: "A chave não pode ter espaços" });
    }
  });

export type AiSettingsInput = z.infer<typeof aiSettingsSchema>;
