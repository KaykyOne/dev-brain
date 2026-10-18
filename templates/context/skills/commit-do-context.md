# Skill PERMANENTE: cada modificação no context vira um commit

Status: ATIVA. Só o humano altera ou remove.

## Regra
- Toda modificação em `context/` (skill, task, PR gerado, nota, template, script, índice) termina em um commit LOCAL neste repositório, sem esperar pedido.
- Esta skill é a autorização permanente SÓ para o repo `context`. Nos repos de código, commit continua só sob pedido (`nova-task.md`).
- Push continua PROIBIDO, inclusive aqui (`proibido-push.md`).

## Um commit por contexto
- Um commit = uma intenção. Nunca misture assuntos.
- Agrupe o que nasce junto: a skill nova com a linha no `README.md`; a task com o PR gerado dela.
- Nunca use `git add -A`/`git add .`: liste os arquivos.

## Mensagem
- pt-BR, minúscula, sem ponto final, sem trailers de IA (`ia-externa.md`).
- Prefixo: `feat:` skill/regra/script/template novo; `docs:` task, PR gerado, nota, índice; `fix:` correção de regra ou script; `chore:` reorganização sem mudar conteúdo.

## Passo a passo
1. `git status --short` para ver o que está pendente.
2. Separe por assunto: `git add <arquivos do assunto>` e `git commit -m "<prefixo>: <o que e por que>"`.
3. Repita por assunto; ao fim, `git status --short` deve estar vazio.
4. Informe ao usuário os commits criados (hash + assunto).

## Não commitar
- Segredos, `.env`, tokens, saída de comando com dados de cliente.
