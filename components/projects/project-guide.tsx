import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpenIcon, GitBranchIcon, KeyRoundIcon, SparklesIcon } from "lucide-react";

const fields = [
  {
    title: "Nome",
    body: "Como o projeto aparece nas listas, no dashboard e nas mensagens. É só um rótulo: pode ter espaços e acentos e ser alterado depois sem quebrar nada. Entra no título do README.md do repositório.",
  },
  {
    title: "Slug",
    body: "Identificador estável, em letras minúsculas, números e hífens. Vai na URL (/projects/meu-projeto) e é o nome da pasta do repositório git no servidor, por isso precisa ser único e não muda depois de criado.",
  },
  {
    title: "Descrição",
    body: "Resumo do que o projeto faz e de quem o usa. Entra no 00-base.md do repositório, que a IA lê sempre; seja objetivo: domínio, stack e o que não deve ser alterado.",
  },
  {
    title: "Branch principal",
    body: "Branch inicial do repositório git (normalmente main). O repositório nasce com o commit “feat: estrutura inicial do context” nela.",
  },
  {
    title: "Skills",
    body: "Há três tipos. As universais valem para todos os projetos. As da biblioteca são skills genéricas e reutilizáveis (por exemplo, o seu fluxo de autodeploy): você cria uma vez e escolhe aqui, ou depois, só os projetos que as usam, sem copiar o conteúdo. As específicas descrevem procedimentos só deste projeto. Os agentes leem as três via MCP (list_skills e get_skill). Independente delas, todo repositório já nasce com as regras permanentes em skills/ (proibido-push, ia-externa, arquivos-gerados, commit-do-context...).",
  },
];

const flow = [
  [GitBranchIcon, "Um repositório git por projeto", "Ao criar o projeto, o DevBrain cria um repositório git de contexto no padrão do hub: README com índice “quando carregar”, 00-base.md, skills/, tasks/, notas/, templates-pr/ e raiz/ (AGENTS.md, CLAUDE.md e .claude/settings.json para copiar para a raiz do projeto de código). Ele vive no servidor, sem remoto: dá para clonar do volume e publicar onde quiser."],
  [BookOpenIcon, "O banco guarda só metadados", "Projetos, registro de skills, propostas pendentes, tokens e atividade ficam no PostgreSQL. O conteúdo do contexto fica no git, com histórico completo."],
  [KeyRoundIcon, "Agentes entram pelo MCP", "Um token de projeto lê e grava o repositório dele (cada gravação é um commit local). Um token de conta (hub) lista e cria projetos: o agente chama create_project e já recebe o repositório pronto e o token dele."],
  [SparklesIcon, "Nunca há push", "O DevBrain não publica nada: não há remoto configurado e as skills permanentes proíbem push. Remover um projeto move o repositório para .trash/, sem apagar o histórico."],
] as const;

export function ProjectGuide() {
  return (
    <aside className="space-y-8 lg:sticky lg:top-6 lg:self-start">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Como o hub funciona</h2>
        <Accordion multiple defaultValue={[flow[0][1]]}>
          {flow.map(([Icon, title, body]) => (
            <AccordionItem key={title} value={title}>
              <AccordionTrigger>
                <span className="flex items-center gap-3">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  {title}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground">{body}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Por que cada campo</h2>
        <Accordion multiple>
          {fields.map(({ title, body }) => (
            <AccordionItem key={title} value={title}>
              <AccordionTrigger>{title}</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground">{body}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </aside>
  );
}
