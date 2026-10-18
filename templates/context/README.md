# context/ — {{name}}

Contexto fatiado de **{{name}}** para a IA carregar só o que precisa. Repositório git próprio, fora dos repos de código.

Ordem de uso: `skills/` (sempre) → `00-base.md` (sempre) → arquivos do tópico.

## Contexto por área
Crie uma pasta por área (`api/`, `front/`, `infra/`...) com arquivos numerados `NN-<assunto>.md` e liste cada um aqui.

| Arquivo | Quando carregar |
| --- | --- |
| `00-base.md` | sempre: visão geral do produto e dos repos |
| _(adicione `<area>/NN-<assunto>.md` conforme o contexto nascer)_ | _(quando a task tocar esse assunto)_ |

## Outros
- `skills/` — fluxos e padrões obrigatórios (ler antes de cada task):
  - `proibido-push.md` — PROÍBE push (permanente).
  - `ia-externa.md` — a IA é externa: zero rastro dentro dos repos de código (permanente).
  - `arquivos-gerados.md` — nunca editar lockfile/arquivo gerado na mão (permanente).
  - `commit-do-context.md` — toda modificação em `context/` vira commit local próprio (permanente).
  - `escopo-de-refatoracao.md` — arquivo criado/alterado fica inteiro no padrão; os demais são ignorados.
  - `nova-task.md` — branch (em inglês) e commits.
  - `registro-de-alteracoes.md` — como registrar onde e por que mexeu em cada repo.
  - `gerar-pr-md.md` — gerar o .md do PR; SÓ quando o usuário pedir.
- `templates-pr/` — templates do .md de PR. Os gerados ficam em `prs/`.
- `scripts/` — verificações automáticas dos padrões (adicione conforme o projeto precisar).
- `notas/` — descobertas e decisões novas (um arquivo por assunto, datado `AAAA-MM-DD-<assunto>.md`).
- `tasks/` — registro das tasks (modelo em `_modelo.md`).
- `raiz/` — arquivos para copiar para a raiz do projeto (`AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`).
- `organizacao-default-context.md` — como este `context` é organizado, para replicar em outros projetos.
