# Skill: nova task (branch + commits)

Vale para toda nova feature, fix, refactor etc. Leia antes de iniciar qualquer task. Ajuste base e formato ao projeto.

## 1. Dados da task
- Precisa de: ID do card e nome da task. Se faltar um, pergunte antes de qualquer comando git.

## 2. Preparar a branch (em cada repo afetado)
- Confira `git status`. Se houver alterações não commitadas, PARE e avise. Não use stash, reset nem checkout forçado por conta própria.
- A base é SEMPRE a branch de integração do projeto (defina em `00-base.md`), atualizada com `git fetch`. Toda branch nasce dela, inclusive fix e hotfix.
- Tocando mais de um repo, use o MESMO nome de branch em todos.

## 3. Nome da branch (SEMPRE EM INGLÊS)
- Formato: `<acao>/<id>-<nome-em-ingles-por-hifens>`; ação: `feature`, `fix`, `hotfix`, `refactor`, `chore`, `docs`, `test`, `perf`.
- Nome: inglês, minúsculo, sem acento, `-` entre palavras, 3 a 6 palavras, verbo no imperativo quando fizer sentido.
- Ex.: `feature/123-add-schedule-filter`, `fix/124-allow-return-to-checkout`.

## 4. Commits (SEMPRE EM PORTUGUÊS)
- Formato: `<acao>: <o que foi feito>`; ação em inglês (`feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`), descrição em pt-BR, sem ponto final, até ~70 caracteres, um commit por mudança lógica.
- Nada de mensagens vagas (`fix`, `lint fix`, `merge fix`).
- Só commite quando o usuário pedir. Push é PROIBIDO (`proibido-push.md`). Zero co-autoria de IA (`ia-externa.md`).

## 5. Depois
- Registrar a task em `tasks/` (modelo em `tasks/_modelo.md`).
- Confirmar que a diff só tem arquivos da task (`escopo-de-refatoracao.md`).
