# Gulosos AI

Next.js 16 (App Router, fullstack via Route Handlers) · PostgreSQL · Drizzle ORM · Zod · shadcn/ui.

## Rodando com Docker (tudo junto)

```bash
cp .env.example .env     # opcional: ajuste APP_URL, ADMIN_* etc.
npm run up               # builda e sobe Postgres + migrations + app em http://localhost:3000
npm run logs             # logs do app
npm run down             # derruba (o volume do banco é mantido)
```

Os serviços: `db` (Postgres), `migrate` (aplica as migrations e encerra) e `app` (Next.js em modo standalone,
só sobe depois das migrations). Dentro do Docker o `DATABASE_URL` aponta para o serviço `db`, ignorando o do `.env`.
Variáveis do compose: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` e `APP_PORT`.

## Prefixo de caminho (ex.: `/ai`)

O prefixo vem do caminho de `APP_URL` (`https://vps.kayky.dev.br/ai` → `basePath: "/ai"`), em um único lugar
(`lib/env.ts`). Links, redirects, assets, `fetch` do cliente e o endpoint MCP seguem esse valor.

- O valor é fixado no **build**; trocar `APP_URL` exige rebuild (`npm run up` já faz).
- O proxy reverso deve **repassar o caminho completo, sem remover o prefixo**. Ex. (nginx):
  `location /ai/ { proxy_pass http://127.0.0.1:3000; }` (sem barra final no `proxy_pass`).
  Com Traefik, não use o middleware `StripPrefix`.
- Sem prefixo, use `APP_URL=http://localhost:3000`.

## Desenvolvimento local (sem Docker no app)

```bash
npm install
cp .env.example .env
npm run db:up        # sobe só o Postgres
npm run db:migrate   # aplica as migrations
npm run dev
```

Na inicialização o app garante o usuário único (`ADMIN_EMAIL`): se não existir, é criado com `ADMIN_INITIAL_PASSWORD` (padrão `Senha123?`); se existir, nada é alterado. Troque a senha em **Perfil** após o primeiro acesso.

## Estrutura

- `lib/env.ts` — único ponto de acesso às variáveis de ambiente, validadas com Zod no boot.
- `db/` — schema Drizzle, conexão, migrations.
- `lib/auth/` — hash de senha (scrypt), sessões em banco (cookie httpOnly) e DAL.
- `app/api/auth/*` — Route Handlers de login e logout.
- `proxy.ts` — redirecionamento otimista; a validação real é feita no DAL.

Após alterar `db/schema.ts`: `npm run db:generate && npm run db:migrate`.

## DevBrain

Central de contexto para agentes de IA. Git é a fonte da verdade dos documentos; o PostgreSQL guarda apenas metadados e estado operacional.

Scripts: `npm test` (Vitest), `npm run typecheck`, `npm run lint`.

### MCP

O DevBrain expõe um servidor MCP (Streamable HTTP) em `${APP_URL}/api/mcp`, autenticado por token Bearer.
Crie tokens e copie os comandos de instalação (Claude Code e Codex) na página `/mcp`.

- `APP_URL` — URL pública do app, com prefixo se houver (ex.: `https://vps.kayky.dev.br/ai`).
- Cada token pertence a um projeto, tem escopos (`context:read`, `changes:propose`), expiração opcional e pode ser revogado. Só o hash é guardado.
- Ferramentas: `get_project`, `list_context_files`, `list_skills`, `get_skill`, `propose_change`, `get_change`.

### Skills

Skills universais (sem projeto) valem para todos os projetos automaticamente; as específicas pertencem a um projeto. Ao criar uma skill dá para importar um `SKILL.md`: nome e descrição vêm do frontmatter e o arquivo é armazenado (`skills.content`) como cópia de trabalho, lida pelos agentes via `get_skill`. O destino de publicação no Git é `devbrain/global/skills/<slug>/` ou `<caminho-do-projeto>/skills/<slug>/`.

Roadmap por etapas: 1) fundação e projetos ✅ · 2) integração GitHub · 3) editor Markdown e skills · 4) sincronização e PRs · 5) API para agentes.
