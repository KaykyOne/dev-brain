/** Textos e nomes de instalação do MCP. Puro: usado no servidor e no navegador. */

/** Nome do servidor MCP: um só para todos os projetos; o projeto vai no argumento `project` das ferramentas. */
export const MCP_SERVER_NAME = "devbrain";

/** Variável de ambiente que guarda a chave de acesso (Codex e `.mcp.json`). */
export const TOKEN_ENV_VAR = "DEVBRAIN_TOKEN";

export const instructionsFileName = (slug: string) => `devbrain-${slug}-AGENTS.md`;

/** O nome entra em um título Markdown: sem quebras de linha nem marcadores que mudem a estrutura. */
const safeTitle = (name: string) => name.replace(/[\r\n`#]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Texto para colar no `AGENTS.md` (ou `CLAUDE.md`) do projeto de código, tornando obrigatório o uso do MCP.
 * O slug identifica o repositório de contexto no MCP único. Mantenha alinhado a templates/context/raiz/AGENTS.md.
 */
export function buildAgentsInstructions({ name, slug }: { name: string; slug: string }): string {
  const server = MCP_SERVER_NAME;

  return `## Contexto do projeto ${safeTitle(name)} — uso OBRIGATÓRIO do MCP \`${server}\`

> **Regra inegociável:** neste projeto, a **primeira ação de toda sessão** é carregar o contexto pelo MCP \`${server}\`.
> Isso **não é opcional**: vale para qualquer task, grande ou pequena, e não pode ser substituído por cópias locais,
> pelo código nem pela sua memória.

O contexto do projeto (regras, skills, visão geral, tasks e notas) está no servidor MCP **\`${server}\`**, no
repositório de contexto **\`${slug}\`**. Ele é a **fonte da verdade**.

**Projeto no DevBrain: \`${slug}\`.** Passe \`project: "${slug}"\` em **toda** chamada de ferramenta do \`${server}\`
(exceto \`list_projects\` e \`create_project\`). Nunca leia nem grave o contexto de outro projeto.

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

Se o servidor \`${server}\` não aparecer, o projeto \`${slug}\` estiver desativado ou uma chamada falhar,
**pare e avise o usuário** antes de continuar. Não improvise o contexto. Só prossiga sem o MCP se o usuário autorizar
de forma explícita, e diga que está sem contexto.
`;
}
