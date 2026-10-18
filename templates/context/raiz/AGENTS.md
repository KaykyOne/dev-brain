# {{name}} — instruções para a IA

Projeto: {{name}}. O contexto vive no repositório git `context/` (ao lado dos repos de código).

## Antes de qualquer task, leia (sempre)
1. `context/skills/proibido-push.md` — NUNCA faça push.
2. `context/skills/ia-externa.md` — zero rastro de IA nos repos de código.
3. `context/skills/arquivos-gerados.md` — não edite lockfile/arquivo gerado na mão.
4. `context/skills/commit-do-context.md` — toda mudança em `context/` vira commit local próprio.
5. `context/00-base.md` — visão geral.

## Conforme a task
| Se a task vai... | Leia |
| --- | --- |
| criar branch / commitar | `context/skills/nova-task.md` |
| mexer em código existente | `context/skills/escopo-de-refatoracao.md` |
| tocar mais de um repo | `context/skills/registro-de-alteracoes.md` |
| gerar descrição de PR (só se pedirem) | `context/skills/gerar-pr-md.md` |
| qualquer assunto de área | a linha correspondente no `context/README.md` |

Registre cada task em `context/tasks/` (modelo em `_modelo.md`). Se contexto e código divergirem, o código vence: avise.
