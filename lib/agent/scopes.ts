export const AGENT_SCOPES = {
  "context:read": "Ler arquivos, histórico e metadados do repositório de contexto do projeto",
  "context:write": "Gravar arquivos no repositório de contexto (cada gravação vira um commit local, sem push)",
  "changes:propose": "Propor e consultar alterações de contexto para revisão humana",
  "projects:create": "Token de conta: listar projetos e iniciar novos repositórios de contexto",
} as const;

export type AgentScope = keyof typeof AGENT_SCOPES;

export const AGENT_SCOPE_KEYS = Object.keys(AGENT_SCOPES) as [AgentScope, ...AgentScope[]];

/** Escopos de um token de conta (hub): não acessa o conteúdo de nenhum projeto. */
export const ACCOUNT_SCOPES: AgentScope[] = ["projects:create"];

/** Escopos de um token de projeto. */
export const PROJECT_SCOPES: AgentScope[] = AGENT_SCOPE_KEYS.filter((scope) => !ACCOUNT_SCOPES.includes(scope));
