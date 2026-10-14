import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpenIcon, GitBranchIcon, KeyRoundIcon, SparklesIcon } from "lucide-react";

const fields = [
  {
    title: "Nome",
    body: "Como o projeto aparece nas listas, no dashboard e nas mensagens. É só um rótulo para você: pode ter espaços e acentos e ser alterado depois sem quebrar nada.",
  },
  {
    title: "Slug",
    body: "Identificador estável do projeto, em letras minúsculas, números e hífens. Ele vai na URL (/projects/meu-projeto) e é a chave que integrações usam para encontrar o projeto, por isso precisa ser único. É gerado a partir do nome, mas você pode ajustar. Evite mudar depois de conectar agentes.",
  },
  {
    title: "Descrição",
    body: "Resumo do que o projeto faz e de quem o usa. Os agentes recebem esse texto pelo MCP (get_project) como primeira orientação, então vale ser objetivo: domínio, stack e o que não deve ser alterado.",
  },
  {
    title: "Caminho no repositório",
    body: "Pasta do projeto dentro do repositório Git de contexto, relativa à raiz (ex.: devbrain/projects/meu-projeto). É lá que ficam context.md, architecture.md, decisions/, memory/ e skills/. Um mesmo repositório pode guardar vários projetos; este caminho diz qual pasta pertence a qual. Caminhos absolutos ou com “..” são recusados por segurança, para que ninguém leia ou escreva fora da pasta autorizada. É preenchido automaticamente a partir do slug (devbrain/projects/<slug>), seguindo a convenção do DevBrain; edite apenas se o seu repositório usar outra estrutura.",
  },
  {
    title: "Branch principal",
    body: "Branch que representa a versão oficial dos documentos (normalmente main). A sincronização lê dela, e as alterações propostas por agentes chegam como Pull Request contra ela. Nada é gravado direto nessa branch.",
  },
  {
    title: "Skills",
    body: "Skills universais valem para todos os projetos, sem anexar nada; elas aparecem como “já incluídas”. As específicas descrevem procedimentos só deste projeto (ex.: “Criar migration” com o padrão do seu ORM). O campo “Quando usar” é o que o agente lê para decidir se aplica a skill, então escreva como uma instrução de gatilho. Você pode importar vários arquivos .md de uma vez (1 arquivo = 1 skill): nome e descrição são lidos do frontmatter e cada arquivo é armazenado para os agentes lerem pelo MCP (get_skill). Depois ele é publicado no repositório, no caminho do projeto.",
  },
];

const flow = [
  [GitBranchIcon, "Git é a fonte da verdade", "Os documentos (contexto, decisões, memória, SKILL.md) são publicados em Markdown no seu repositório, com histórico, revisão e permissões do GitHub. Enquanto o GitHub não está vinculado, as skills importadas ficam guardadas no DevBrain como cópia de trabalho."],
  [BookOpenIcon, "O banco guarda só metadados", "Projetos, registro de skills, estado de sincronização, propostas pendentes e tokens ficam no PostgreSQL. É o estado operacional, aquilo que o Git não representa."],
  [KeyRoundIcon, "Agentes entram pelo MCP", "Claude Code e Codex se conectam com um token que vale para um único projeto e pode ser revogado. Eles consultam contexto e skills e propõem atualizações."],
  [SparklesIcon, "Nada é publicado sem revisão", "Toda proposta de agente fica pendente. Você revisa o diff, aprova e o DevBrain abre um Pull Request. Agentes nunca escrevem direto na branch principal."],
] as const;

export function ProjectGuide() {
  return (
    <aside className="space-y-8 lg:sticky lg:top-6 lg:self-start">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Como o DevBrain funciona</h2>
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
