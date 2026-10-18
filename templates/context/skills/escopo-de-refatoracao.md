# Skill: escopo de refatoração (padrão no arquivo mexido, nunca no sistema todo)

A unidade da migração de padrão é o ARQUIVO: se a task mexeu no arquivo, ele inteiro fica no padrão; se não mexeu, ninguém toca.

## Regra
- **Arquivo novo**: nasce 100% no padrão.
- **Arquivo existente que a task altera (mesmo 1 linha)**: deixe o arquivo INTEIRO no padrão, além da mudança da task.
- **Arquivo que a task não altera**: ignore. Não mexa, nem para "aproveitar", padronizar ou limpar.

## Proibido
- Varrer o repo para achar violações e corrigir em outros arquivos.
- Rodar formatador/fix em pasta ou repo inteiro. Rode só nos arquivos alterados pela task.
- Renomear, mover ou reestruturar arquivos que a task não precisa alterar.

## Arquivo grande (> 300 linhas)
- Se a padronização inteira geraria uma diff grande, PARE e pergunte: (a) padronizar tudo, (b) só o trecho alterado, ou (c) deixar para outra task. Até a resposta, faça só a mudança da task.

## Se encontrar violação em arquivo fora da task
- Não corrija. Se for relevante, cite em uma linha ou anote em `notas/`.

## Dúvida
- Se não souber se um arquivo faz parte da task, trate como fora do escopo e pergunte.
