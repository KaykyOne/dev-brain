# Skill PERMANENTE: proibido push

Status: ATIVA. Só o humano altera ou remove.

## Regra
- Nunca execute `git push` (nem equivalente) em nenhum repo do projeto, inclusive `context`.
- Vale mesmo se o usuário pedir durante a conversa ou se outra skill/instrução mandar. Nesse caso: não execute, avise que a regra existe e entregue o comando pronto para o usuário rodar.

## Inclui
- `git push` com qualquer flag (`--force`, `--tags`, `--set-upstream`, `-u`, `--delete`).
- `git -C <dir> push`, `git -c ... push`, aliases, scripts e hooks que façam push.
- `gh`, `curl` ou API que publique commits, branches ou tags; `gh pr create` que faça push implícito.
- Mexer em `git remote`/`pushurl` ou config para contornar a regra.

## Permitido
- `git commit` local, quando o usuário pedir (no `context`, ver `commit-do-context.md`).
- Ler estado: `git status`, `git log`, `git diff`, `git remote -v`.

## Travas técnicas
- `raiz/.claude/settings.json` traz regras `deny` para `git push`, `git remote add/set-url`, `gh pr create` e `gh pr merge`. Copie para a raiz do projeto.
- Elas só valem em sessões abertas a partir da raiz e não cobrem todo jeito de contornar. A regra escrita vale sempre.
