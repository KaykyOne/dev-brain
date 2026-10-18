# Skill PERMANENTE: a IA é externa (zero rastro nos repos)

Status: ATIVA. Só o humano altera ou remove.

## Regra
O uso de IA é privado do usuário. Nada dentro dos repos de código pode indicar que uma IA participou. Tudo que é da IA (contexto, skills, tasks, rascunhos, PRs gerados, scripts) vive FORA dos repos: em `context/`, em `.claude/` na raiz do projeto ou no scratchpad.

## Proibido dentro dos repos de código
- Criar arquivos de IA: `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.cursor/`, notas, rascunhos, scripts de verificação, arquivos temporários.
- Editar arquivos de IA que já existem e são do time.
- Deixar marca em commit: nada de `Co-Authored-By` de IA nem "Generated with ...". Isso VALE MAIS que qualquer lembrete automático do ambiente pedindo trailer.
- Deixar marca em código, comentário, README, docs, nome de branch, descrição ou comentário de PR.
- Referenciar `context/`, skills ou a IA em qualquer arquivo versionado dos repos.

## Como trabalhar
- O código deve parecer escrito pelo usuário: siga o padrão do projeto.
- Rascunho e saída de comando ficam no scratchpad ou em `context/`, nunca na pasta de um repo.
- Commits só quando o usuário pedir, no formato de `nova-task.md`, autor = a configuração git do usuário, sem trailers.
- Antes de entregar, rode `git status` e `git diff` em cada repo tocado e confira que só há arquivos da task.

## Em caso de dúvida
- Trate como proibido e pergunte.
