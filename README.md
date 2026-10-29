<div align="center">

<img src="public/icon.png" alt="DevBrain" width="160" />

# DevBrain

**A central de contexto dos seus agentes de IA.**
Um repositório git de contexto por projeto, servido por MCP para o Claude Code, o Codex e qualquer agente compatível.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle-336791?logo=postgresql&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-Streamable%20HTTP-7c3aed)
![Docker](https://img.shields.io/badge/Docker-pronto-2496ed?logo=docker&logoColor=white)

</div>

---

## O que é

Agentes de código esquecem tudo a cada sessão. O DevBrain resolve isso guardando, **por projeto**, as regras, skills,
visão geral, tasks e notas em um repositório git, e entregando esse contexto ao agente pelo protocolo MCP.

> **Git é a fonte da verdade** dos documentos. O PostgreSQL guarda apenas metadados e estado operacional.

```
 Você ──► DevBrain (web) ──► repositório git de contexto (um por projeto)
                                      ▲
 Claude Code / Codex ──── MCP ────────┘   lê o contexto, registra o que aprendeu
```

## Principais recursos

| | Recurso | O que faz |
|---|---|---|
| 📁 | **Projetos** | Cada projeto ganha um repositório git no padrão do hub: `README.md` com índice "quando carregar", `00-base.md`, `skills/`, `tasks/`, `notas/`, `templates-pr/` e `raiz/`. |
| ✨ | **Skills** | Universais, de biblioteca (criadas uma vez, aplicadas em vários projetos) e de projeto. Busca com grifo, promoção e editor Markdown. |
| 🔌 | **Servidor MCP** | Um servidor só para todos os projetos, com uma chave de acesso. Você escolhe quais projetos ficam acessíveis. Comandos de instalação prontos para Claude Code e Codex. |
| 📜 | **AGENTS.md por projeto** | Gera, para copiar ou baixar, o texto que torna **obrigatório** o uso do MCP pelo agente. |
| 🤖 | **Assistente de IA** | Chat que cria skills e projetos e grava contexto, mostrando cada ação como um passo. |
| 🪵 | **Logs** | Erros e eventos do servidor persistidos e filtráveis na própria interface. |

## Começando

### Com Docker (tudo junto)

```bash
cp .env.example .env     # opcional: ajuste APP_URL, ADMIN_* etc.
npm run up               # builda e sobe Postgres + migrations + app em http://localhost:3000
npm run logs             # logs do app
npm run down             # derruba (o volume do banco é mantido)
```

Os serviços: `db` (Postgres), `migrate` (aplica as migrations e encerra) e `app` (Next.js em modo standalone,
só sobe depois das migrations). Dentro do Docker o `DATABASE_URL` aponta para o serviço `db`, ignorando o do `.env`.
Variáveis do compose: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` e `APP_PORT`.

### Desenvolvimento local (sem Docker no app)

```bash
npm install
cp .env.example .env
npm run db:up        # sobe só o Postgres
npm run db:migrate   # aplica as migrations
npm run dev
```

Na inicialização o app garante o usuário único (`ADMIN_EMAIL`): se não existir, é criado com `ADMIN_INITIAL_PASSWORD`
(padrão `Senha123?`); se existir, nada é alterado. Troque a senha em **Perfil** após o primeiro acesso.

Scripts úteis: `npm test` (Vitest), `npm run typecheck`, `npm run lint`.
Após alterar o schema: `npm run db:generate`. As migrations pendentes são aplicadas automaticamente quando o app inicia (`npm run dev` ou `start`); `npm run db:migrate` continua disponível para rodar manualmente.

## Conectando um agente (MCP)

Um **único** servidor MCP (Streamable HTTP), `devbrain`, atende todos os projetos em `${APP_URL}/api/mcp`, autenticado
por uma **chave de acesso** (Bearer). Em **/mcp → Instalação** você gera a chave e copia os comandos já preenchidos.
Instale uma vez por máquina:

**Claude Code**

```bash
claude mcp add --transport http --scope user devbrain https://seu-app/api/mcp \
  --header "Authorization: Bearer <SUA_CHAVE>"
```

**Codex**

```bash
export DEVBRAIN_TOKEN="<SUA_CHAVE>"
codex mcp add devbrain --url https://seu-app/api/mcp --bearer-token-env-var DEVBRAIN_TOKEN
```

- **Qual projeto?** O `AGENTS.md` do projeto de código diz o slug do projeto no DevBrain, e o agente o passa no
  argumento `project` de cada ferramenta. Em **/mcp → AGENTS.md** escolha o projeto e copie ou baixe o texto (todo
  repositório de contexto também já nasce com ele em `raiz/AGENTS.md`). O texto manda ler o índice e as skills antes de
  qualquer task, registrar o que aprender e parar se o MCP falhar.
- **Acesso**: não há tokens por projeto nem escopos. Em **/mcp → Projetos** você liga e desliga quais projetos o MCP
  atende; num projeto desativado o agente recebe um aviso para pedir a reativação (e você, uma notificação).
- **Chave**: só existe uma por vez (gerar uma nova revoga a anterior) e só o hash é guardado. **Revogar todos os
  tokens** derruba todo acesso, inclusive os tokens de projeto do modelo antigo, que já não são aceitos. Nunca há push:
  cada gravação vira um commit local.
- **Ferramentas**: `list_projects`, `create_project` e, com `project`: `get_project`, `list_context_files`,
  `read_context_file`, `write_context_file`, `repo_log`, `list_skills`, `get_skill`, `propose_change`, `get_change`.

## Skills

- **Universais** valem para todos os projetos automaticamente.
- **Biblioteca** (hub): skills genéricas e reutilizáveis (ex.: o fluxo de autodeploy). Crie uma vez e escolha em quais
  projetos aplicar. O conteúdo fica em um lugar só: editar atualiza todos os projetos; remover a aplicação não apaga a
  skill. Uma skill de projeto pode ser promovida à biblioteca (ou a universal) pelo ícone de globo.
- **De projeto** pertencem a um único projeto.

Com o mesmo slug em mais de um escopo, o MCP entrega a mais específica: projeto, depois biblioteca, depois universal.
Ao criar uma skill dá para importar um `SKILL.md`: nome e descrição vêm do frontmatter. O destino de publicação no Git é
`devbrain/global/skills/<slug>/` ou `<caminho-do-projeto>/skills/<slug>/`.

## Detalhes

### Skills: busca, promoção e editor Markdown

- Cada seção da página **Skills** (universais e por projeto) tem um campo de busca: título, descrição, conteúdo do
  `SKILL.md` e, em projetos, o nome do projeto (sem diferenciar maiúsculas nem acentos). Os acertos são grifados em
  amarelo; quando o termo está só no conteúdo, apenas o caminho da skill é grifado.
- **Tornar universal** (ícone de globo nas skills de projeto) abre um modal para revisar e editar a skill antes de
  confirmar. Por padrão a skill é movida; marque "Manter também no projeto" para copiar.
- O editor Markdown (`components/markdown`) usa CodeMirror 6 (carregado sob demanda) com barra de formatação, modo
  dividido e preview renderizado (`react-markdown` + GFM; HTML cru não é interpretado). É usado ao criar/editar skills,
  ao promovê-las e no cadastro de projeto; arquivos `.md` do repositório abrem no visualizador (renderizado ou código).

### Assistente de IA

Botão no canto inferior direito de todas as telas do dashboard que abre um chat com um assistente capaz de criar e
atualizar skills, aplicar skills da biblioteca em projetos, criar e editar projetos e gravar arquivos de contexto. Cada
ação aparece no chat como um passo (ação, alvo, resultado, o que mudou antes → depois e links), como no Claude Code.

**Configuração (`.env`)**: já vem pré-configurada para o **DeepSeek Flash**; basta definir a chave. Sem `AI_API_KEY` o
assistente fica desativado (o chat explica o que falta).

| Variável | Padrão | |
|---|---|---|
| `AI_API_KEY` | _(vazia)_ | Chave do provedor (https://platform.deepseek.com/api_keys). Nunca vai para o navegador. |
| `AI_PROVIDER` | `deepseek` | `deepseek`, `openai`, `openrouter` ou `custom` (qualquer API compatível com a da OpenAI). |
| `AI_MODEL` | `deepseek-flash` | Obrigatório fora do DeepSeek. |
| `AI_BASE_URL` | do provedor | Só para `custom`, ou para sobrescrever a URL. |
| `AI_THINKING` | `disabled` | `enabled` liga o raciocínio do DeepSeek (mais lento e caro). O `reasoning_content` é devolvido em todos os turnos, como a API exige. |
| `AI_MAX_STEPS` | `12` | Rodadas de ferramentas por mensagem. |

**Ações (`lib/assistant/actions.json`)**: lista o que o assistente pode fazer. Cada ação tem `enabled` (libera ou
bloqueia), `confirm` (exige aprovação do usuário no chat antes de executar) e `mutates`. Toda ação de remoção tem
`confirm: true` (um teste garante). Para adicionar uma ação: descreva-a no JSON, valide os argumentos em
`schemas.ts` e implemente o handler em `handlers.ts`; testes conferem que os três descrevem as mesmas ações.

**Segurança**: a rota `/api/assistant` exige sessão e limita 30 mensagens por minuto; os argumentos de cada ação são
validados (esquemas estritos) e as ações reutilizam as mesmas regras de posse e de segredos do restante do app; ações
destrutivas só rodam com a aprovação do usuário, imposta no servidor; o conteúdo lido (skills, arquivos) é tratado como
dado, e não como instrução. Erros do provedor vão para a página Logs, com o detalhe técnico e sem a chave.

### Logs

Erros, avisos e eventos do servidor são gravados na tabela `app_logs` e aparecem na página **Logs** (filtro por nível,
busca e detalhes com stack). Cobrem falhas que o usuário vê (ex.: criação de repositório), erros não tratados de
renderização, route handlers e server actions (`onRequestError`), e um diagnóstico na subida: git instalado e pasta dos
repositórios gravável. Tokens e senhas são redigidos antes de gravar; registros com mais de 30 dias são apagados na subida.
Também saem no stdout (`npm run logs`).

### Prefixo de caminho (ex.: `/ai`)

O prefixo vem do caminho de `APP_URL` (`https://vps.kayky.dev.br/ai` → `basePath: "/ai"`), em um único lugar
(`lib/env.ts`). Links, redirects, assets, `fetch` do cliente e o endpoint MCP seguem esse valor.

- O valor é fixado no **build**; trocar `APP_URL` exige rebuild (`npm run up` já faz).
- O proxy reverso deve **repassar o caminho completo, sem remover o prefixo**. Ex. (nginx):
  `location /ai/ { proxy_pass http://127.0.0.1:3000; }` (sem barra final no `proxy_pass`).
  Com Traefik, não use o middleware `StripPrefix`.
  Com Caddy, use `handle` (e **não** `handle_path`, que remove o prefixo) e não adicione `redir /ai /ai/`
  (o Next normaliza `/ai/` para `/ai` e geraria um loop):

  ```caddy
  @ai path /ai /ai/*
  handle @ai {
      reverse_proxy 127.0.0.1:3221
  }
  ```

  Se o Caddy roda em Docker com o Caddyfile montado como **arquivo** (bind mount), editar com um editor que troca
  o arquivo (inode novo) faz o container continuar lendo a versão antiga: `caddy reload` não aplica nada.
  Use `docker restart caddy` (ou edite no mesmo inode) e confira com `docker exec caddy grep "@ai" /etc/caddy/Caddyfile`.
- Sem prefixo, use `APP_URL=http://localhost:3000`.

## Estrutura

- `app/` — rotas (App Router), Route Handlers (`/api/mcp`, `/api/assistant`, `/api/auth/*`).
- `components/` — UI (shadcn/ui), editor Markdown, assistente, skills, MCP.
- `lib/` — env validado com Zod (`lib/env.ts`), auth (scrypt + sessões em banco), repositórios de contexto, skills, agente MCP, assistente, logger.
- `db/` — schema Drizzle e migrations.
- `templates/context/` — modelo do repositório de contexto criado para cada projeto.
- `proxy.ts` — redirecionamento otimista; a validação real é feita no DAL.

## Roadmap

1. Fundação e projetos ✅ · 2. Integração GitHub · 3. Editor Markdown e skills ✅ · 4. Sincronização e PRs · 5. API para agentes ✅

<div align="center"><sub>Feito pela Gulosos AI</sub></div>
