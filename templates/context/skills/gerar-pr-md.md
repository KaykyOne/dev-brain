# Skill: gerar o .md do PR (SÓ quando o usuário pedir)

Use SOMENTE quando o usuário pedir o .md / a descrição do PR. Não gere por conta própria ao terminar uma task.

## Template
- Use `templates-pr/default.md` ou o template específico do repo, se houver. A fonte oficial é o `.github/pull_request_template.md` do repo; o de `templates-pr/` é um snapshot. Se divergirem, use a estrutura do repo e sugira atualizar o snapshot.

## Como preencher
1. Copie o template inteiro, sem remover seções nem comentários.
2. Troque os placeholders `<...>`. Link de card/PR relacionado: só o que o usuário informou; não invente.
3. Descrição técnica curta, em pt-BR, baseada no que foi feito de verdade (`git diff` e a task em `tasks/`).
4. Marque `[x]` SÓ o que foi verificado nesta task (testes rodados, build, etc.). Em dúvida, deixe desmarcado e avise.
5. O texto deve ler como escrito pelo usuário: sem menção a IA (`ia-externa.md`).

## Entrega
- Salve em `prs/PR-<repo>-<id>.md` e informe o caminho. Mostre o que ficou desmarcado e por quê.
- Não abra PR, não faça push (`proibido-push.md`).
