# Skill PERMANENTE: nunca editar arquivo gerado automaticamente na mão

Status: ATIVA. Só o humano altera ou remove. Vale mesmo que o usuário peça "só uma linha".

## Regra
- É PROIBIDO criar, editar, apagar, mover ou "consertar" na mão qualquer arquivo gerado por ferramenta (Edit/Write, `sed -i`, `>`/`>>`, `tee`, merge manual de conflito dentro do arquivo).
- Se o arquivo gerado precisa mudar, quem muda é o comando da própria ferramenta, e só quando a task exige e o usuário aprovou.

## Lista (não exaustiva; na dúvida, é gerado)
| Tipo | Arquivos |
| --- | --- |
| Lockfiles | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lock`, `composer.lock`, `Cargo.lock`, `poetry.lock` |
| Build/cache | `.next/`, `build/`, `dist/`, `node_modules/`, `vendor/`, `*.tsbuildinfo`, `next-env.d.ts` |
| Outros | migrations `meta/` do drizzle, `*.min.js`, qualquer arquivo com cabeçalho "auto-generated"/"do not edit" |

## Efeito colateral inesperado
- Se um comando alterar um lockfile ou arquivo gerado sem a task pedir: NÃO desfaça na mão e NÃO commite. Avise o usuário com o `git diff --stat` e deixe ele decidir.
- Nunca incluir lockfile em commit de task que não mexe em dependência.
- Conflito em lockfile: não resolver na mão; o usuário regenera pelo gerenciador.
