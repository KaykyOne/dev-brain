# Organização default do repositório `context`

Guia replicável: a mesma estrutura serve para qualquer projeto (um ou vários repos). A IA passa a trabalhar com contexto fatiado, regras permanentes e registro de tarefas.

## 1. Princípios (IA first)
1. **Fora dos repos**: o `context/` tem git próprio e fica ao lado dos repos de código. A IA não deixa rastro dentro deles (`skills/ia-externa.md`).
2. **Fonte única**: cada regra existe em UM arquivo. Os demais apontam para ele.
3. **Carregamento sob demanda**: arquivos curtos e fatiados; a IA lê só o que a task toca (tabela "Quando carregar" no `README.md`).
4. **Código vence**: se contexto e código divergirem, vale o código e a IA avisa que o contexto está velho.
5. **Regra permanente = skill com `Status: ATIVA. Só o humano altera ou remove.`**
6. **Um commit por assunto** no `context` (`skills/commit-do-context.md`). Push sempre proibido.
7. **Texto curto, em listas e tabelas**, com comandos prontos. Sem prosa longa.

## 2. Estrutura de pastas
```
<raiz-do-projeto>/            # NÃO é repo git; agrupa os repos
├── AGENTS.md                 # entrada da IA (modelo em context/raiz/)
├── CLAUDE.md                 # só contém: @AGENTS.md
├── .claude/settings.json     # deny de push, remote, gh pr create/merge
├── <repo-a>/ <repo-b>/ ...   # repos de código
└── context/                  # repo git próprio (este)
    ├── README.md             # índice: tabela "arquivo → quando carregar"
    ├── 00-base.md            # visão geral do produto e dos repos
    ├── <area>/NN-<assunto>.md  # contexto por área, numerado
    ├── skills/               # fluxos e padrões obrigatórios (conteúdo único)
    ├── templates-pr/         # templates de descrição de PR
    ├── prs/                  # PRs gerados, só sob pedido
    ├── tasks/                # registro de tasks (+ _modelo.md)
    ├── notas/                # descobertas e decisões, 1 assunto por arquivo, datado
    ├── scripts/              # verificações automáticas
    └── raiz/                 # arquivos para copiar para a raiz do projeto
```

## 3. Papel de cada peça
| Peça | O que é | Regra de ouro |
| --- | --- | --- |
| `AGENTS.md` (raiz) | Porta de entrada: regras permanentes, tabela "se a task vai... leia..." | Curto; aponta para `context/`, não duplica |
| `CLAUDE.md` | `@AGENTS.md` | Nenhum conteúdo próprio |
| `context/skills/*.md` | Conteúdo único de cada regra/fluxo | Um tema por arquivo |
| `context/<area>/NN-*.md` | Conhecimento do domínio/código por área | Numerado, fatiado, "quando carregar" no README |
| `context/tasks/` | Registro de cada task | Ciclo de vida abaixo |
| `context/notas/` | Algo relevante fora do contexto | `AAAA-MM-DD-<assunto>.md` |

## 4. Anatomia de uma skill
Arquivo `context/skills/<nome>.md`:
```
# Skill [PERMANENTE:] <título>
Status: ATIVA. Só o humano altera ou remove.   (só nas permanentes)
## Regra        (o que fazer, imperativo, curto)
## Inclui / Proibido / Permitido   (bordas da regra)
## Como trabalhar / Passo a passo
## Em caso de dúvida                (default seguro)
```
Nova skill = mesmo commit: o `.md`, a linha no `README.md` e, se for "sempre ler", a linha no `AGENTS.md`.

## 5. Ciclo de vida de uma task
1. Início: criar `tasks/AAAA-MM-DD-<slug>.md` a partir de `tasks/_modelo.md` (objetivo, plano, repos).
2. Execução: branch da base protegida; seguir as skills "sempre" + as da área tocada.
3. Fim: preencher "Feito", "Alterações por repo (onde e por quê)", "Validar"; renomear para `aguardando-validacao-humana-AAAA-MM-DD-<slug>.md`.
4. Só o humano remove o prefixo `aguardando-validacao-humana-`.
5. Rodar as verificações de `scripts/`, se houver, antes de entregar.
6. Commitar a task (e o PR gerado, se houver) no `context` num commit próprio.

## 6. Convenções de commit no `context`
- Um commit por assunto; `git add <arquivos>` explícito, nunca `-A`.
- Prefixos: `feat:` (skill/regra/script/template novo), `docs:` (task, PR, nota, índice), `fix:`, `chore:`.
- pt-BR, sem trailer de IA, sem push.
