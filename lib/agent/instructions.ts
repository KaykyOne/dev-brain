/** Textos e nomes de instalação do MCP por projeto. Puro: usado no servidor e no navegador. */

/** Nome do servidor MCP: um por projeto (`devbrain-<slug>`) e `devbrain` para o token de conta (hub). */
export const mcpServerName = (slug?: string | null) => (slug ? `devbrain-${slug}` : "devbrain");

/** Variável de ambiente que guarda o token (Codex e `.mcp.json`), uma por projeto. */
export const tokenEnvVar = (slug?: string | null) =>
  slug ? `DEVBRAIN_TOKEN_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}` : "DEVBRAIN_TOKEN";

export const instructionsFileName = (slug: string) => `devbrain-${slug}-AGENTS.md`;

/** O nome entra em um título Markdown: sem quebras de linha nem marcadores que mudem a estrutura. */
const safeTitle = (name: string) => name.replace(/[\r\n`#]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Texto para colar no `AGENTS.md` (ou `CLAUDE.md`) do projeto de código, tornando obrigatório o uso do MCP.
 * Descreve só ferramentas que o servidor realmente expõe para tokens de projeto.
 */
export function buildAgentsInstructions({ name, slug }: { name: string; slug: string }): string {
  const server = mcpServerName(slug);

  return `## Contexto do projeto ${safeTitle(name)} — uso OBRIGATÓRIO do MCP \`${server}\`

> **Regra inegociável:** neste projeto, a **primeira ação de toda sessão** é carregar o contexto pelo MCP \`${server}\`.
> Isso **não é opcional**: vale para qualquer task, grande ou pequena, e não pode ser substituído por cópias locais,
> pelo código nem pela sua memória.

O contexto do projeto (regras, skills, visão geral, tasks e notas) está no servidor MCP **\`${server}\`**.
Ele é a **fonte da verdade**.

### Antes de qualquer task (sempre, nesta ordem)

1. Chame \`read_context_file\` com \`README.md\`: é o índice, que diz quando carregar cada arquivo.
2. Leia com \`read_context_file\` tudo que o índice marca como obrigatório: os arquivos de \`skills/\` e o \`00-base.md\`.
3. Chame \`list_skills\` e, para cada skill cuja descrição combine com a task, chame \`get_skill\`.
4. Conforme o assunto da task, carregue os arquivos que o índice indicar.

Não responda perguntas sobre o projeto nem altere código antes de concluir esses passos. Na sua primeira resposta,
**liste os arquivos de contexto que você leu**, para que o usuário confirme que o MCP foi usado.
Se o contexto e o código divergirem, o código vence: avise o usuário.

### Durante e depois da task

- Registre o que aprender com \`write_context_file\`: a task em \`tasks/\` e cada descoberta em \`notas/AAAA-MM-DD-assunto.md\`.
  Cada gravação vira um commit local no repositório de contexto; não existe push.
- Para consultar o histórico, use \`repo_log\`. Para sugerir mudanças que dependem de revisão, use \`propose_change\`.

### Se o MCP não estiver disponível

Se o servidor \`${server}\` não aparecer ou uma chamada falhar, **pare e avise o usuário** antes de continuar.
Não improvise o contexto. Só prossiga sem o MCP se o usuário autorizar de forma explícita, e diga que está sem contexto.
`;
}
