# Skill: registro de alterações entre repos

A IA pode alterar qualquer repo do projeto quando a task exigir. Em troca, tudo precisa ficar explícito. Os registros (tasks, notas) ficam em `context/`, NUNCA dentro de um repo de código (`ia-externa.md`).

## Antes de mexer
- Diga ao usuário, em uma linha por repo, quais repos vai tocar e por quê.
- Siga `nova-task.md`: mesma branch em todos os repos afetados, com `git status` limpo antes.

## Ao mexer
- Altere só o necessário. Mudança de contrato (rota, campo, evento) é feita nos dois lados na mesma task.
- Não aproveite para refatorar fora do escopo; se achar algo, registre em `notas/`.

## Ao terminar
- Preencha "Alterações por repo (onde e por quê)" da task em `tasks/`: para cada arquivo, o que mudou e o motivo.
- Na resposta final, liste por repo: arquivos alterados, motivo e o que o usuário precisa validar ou rodar (migration, seeder, build).
- Se a mudança em um repo exige ação em outro (migration, variável de ambiente, novo evento), diga isso explicitamente.
