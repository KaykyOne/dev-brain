export const AGENT_SCOPES = {
  "context:read": "Consultar metadados do projeto e dos arquivos de contexto",
  "changes:propose": "Propor e consultar alterações de contexto",
} as const;

export type AgentScope = keyof typeof AGENT_SCOPES;

export const AGENT_SCOPE_KEYS = Object.keys(AGENT_SCOPES) as [AgentScope, ...AgentScope[]];
