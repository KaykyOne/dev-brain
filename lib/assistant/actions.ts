import { z } from "zod";

import raw from "./actions.json";

/** Contrato do actions.json. Qualquer erro aqui derruba o carregamento, em vez de liberar uma ação mal definida. */
const actionSchema = z
  .object({
    name: z.string().regex(/^[a-z][a-z0-9_]{0,62}$/, "nome inválido para ferramenta"),
    label: z.string().min(1),
    description: z.string().min(10),
    enabled: z.boolean(),
    mutates: z.boolean(),
    confirm: z.boolean(),
    parameters: z.object({
      type: z.literal("object"),
      properties: z.record(z.string(), z.record(z.string(), z.unknown())),
      required: z.array(z.string()).optional(),
      additionalProperties: z.literal(false),
    }),
    example: z.record(z.string(), z.unknown()),
  })
  .strict()
  .refine((action) => !action.confirm || action.mutates, { message: "ação com confirm precisa ter mutates=true" })
  .refine((action) => (action.parameters.required ?? []).every((key) => key in action.parameters.properties), {
    message: "required cita parâmetro que não existe em properties",
  });

const fileSchema = z
  .object({ version: z.literal(1), _comment: z.string().optional(), actions: z.array(actionSchema).min(1) })
  .refine((file) => new Set(file.actions.map((action) => action.name)).size === file.actions.length, {
    message: "nomes de ação duplicados",
  });

export type AssistantAction = z.infer<typeof actionSchema>;

export const ACTIONS: AssistantAction[] = fileSchema.parse(raw).actions;

export const getAction = (name: string) => ACTIONS.find((action) => action.name === name);

/** Rótulo em português para exibir no chat. */
export const actionLabel = (name: string) => getAction(name)?.label ?? name;

export const enabledActions = () => ACTIONS.filter((action) => action.enabled);

/** Definições no formato de ferramentas da API de chat completions. Só as ações liberadas. */
export function toolDefinitions() {
  return enabledActions().map((action) => ({
    type: "function" as const,
    function: { name: action.name, description: action.description, parameters: action.parameters },
  }));
}
