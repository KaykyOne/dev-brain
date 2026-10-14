# Gulosos AI

Next.js 16 (App Router, fullstack via Route Handlers) · PostgreSQL · Drizzle ORM · Zod · shadcn/ui.

## Setup

```bash
npm install
cp .env.example .env
npm run db:up        # sobe o Postgres (docker compose)
npm run db:migrate   # aplica as migrations
npm run db:seed      # cria admin@gulosos.ai / admin12345
npm run dev
```

## Estrutura

- `lib/env.ts` — único ponto de acesso às variáveis de ambiente, validadas com Zod no boot.
- `db/` — schema Drizzle, conexão, migrations e seed.
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
