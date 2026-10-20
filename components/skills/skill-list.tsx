import { SparklesIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Highlight, MARK_CLASS } from "@/components/shared/highlight";
import { Badge } from "@/components/ui/badge";
import type { Skill } from "@/db/schema";
import { skillRepoPath } from "@/lib/skills/paths";
import { includesText } from "@/lib/skills/search";

import { DeleteSkillButton } from "./delete-skill-button";
import { PromoteSkillDialog } from "./promote-skill-dialog";
import { SkillDialog } from "./skill-dialog";
import { SkillProjectsDialog } from "./skill-projects-dialog";
import { SkillViewDialog } from "./skill-view-dialog";
import { UnlinkSkillButton } from "./unlink-skill-button";

type SkillRow = Skill & {
  /** Só em skills da biblioteca: ids dos projetos em que estão aplicadas. */
  projectIds?: string[];
};

type SkillListProps = {
  skills: SkillRow[];
  /** Projeto dono das skills de projeto (define o caminho no repositório). */
  project?: { name?: string; slug: string; repositoryPath: string | null } | null;
  /** Somente leitura (ex.: universais exibidas na aba de um projeto, gerenciadas em /skills). */
  readOnly?: boolean;
  /** Termo da busca: grifa onde ele aparece (título e descrição; no conteúdo, o caminho). */
  query?: string;
  /** Todos os projetos do dono. Habilita "aplicar em projetos" na biblioteca e a promoção de skills de projeto. */
  allProjects?: { id: string; name: string }[];
  /** Na aba de um projeto: lista skills da biblioteca aplicadas a ele, com a ação de remover a aplicação. */
  unlinkFrom?: { id: string };
  emptyTitle: string;
  emptyDescription?: string;
};

export function SkillList({
  skills,
  project = null,
  readOnly = false,
  query,
  allProjects,
  unlinkFrom,
  emptyTitle,
  emptyDescription,
}: SkillListProps) {
  if (skills.length === 0) {
    return <EmptyState icon={SparklesIcon} title={emptyTitle} description={emptyDescription} />;
  }

  const projectNames = new Map((allProjects ?? []).map((item) => [item.id, item.name]));

  return (
    <ul className="divide-y rounded-lg border">
      {skills.map((skill) => {
        const isLibrary = skill.scope === "library";
        const path = skillRepoPath({
          slug: skill.slug,
          project: skill.scope === "project" ? project : null,
          library: isLibrary,
        });
        const foundInContent = !!query && !!skill.content && includesText(skill.content, query);
        const editable = !readOnly && !unlinkFrom;
        const form = { id: skill.id, name: skill.name, description: skill.description, content: skill.content ?? "" };

        return (
          <li key={skill.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 space-y-1">
              <p className="font-medium">
                <Highlight text={skill.name} query={query} />
              </p>
              <p className="text-sm text-muted-foreground">
                <Highlight text={skill.description} query={query} />
              </p>
              <p className="text-xs text-muted-foreground">
                {skill.content ? `SKILL.md armazenado · ${skill.content.split("\n").length} linhas` : "Sem arquivo SKILL.md"}
              </p>
              {/* Achado no conteúdo: grifa só o caminho, para localizar a skill sem poluir a lista. */}
              <p
                className="truncate font-mono text-xs text-muted-foreground"
                title={foundInContent ? "Termo encontrado no conteúdo do SKILL.md" : undefined}
              >
                {foundInContent ? <mark className={MARK_CLASS}>{path}</mark> : path}
              </p>
              {isLibrary && editable && skill.projectIds && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs text-muted-foreground">Aplicada em:</span>
                  {skill.projectIds.length === 0 ? (
                    <span className="text-xs text-muted-foreground">nenhum projeto ainda</span>
                  ) : (
                    skill.projectIds.map((id) => (
                      <Badge key={id} variant="outline">
                        <Highlight text={projectNames.get(id) ?? "Projeto removido"} query={query} />
                      </Badge>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center">
              <SkillViewDialog name={skill.name} description={skill.description} path={path} content={skill.content} />
              {unlinkFrom && <UnlinkSkillButton projectId={unlinkFrom.id} skillId={skill.id} name={skill.name} />}
              {editable && (
                <>
                  {isLibrary && allProjects && (
                    <SkillProjectsDialog
                      skill={{ id: skill.id, name: skill.name }}
                      projects={allProjects}
                      applied={skill.projectIds ?? []}
                    />
                  )}
                  {skill.scope === "project" && allProjects && (
                    <PromoteSkillDialog
                      projectName={project?.name}
                      originProjectId={skill.projectId ?? undefined}
                      projects={allProjects}
                      skill={form}
                    />
                  )}
                  <SkillDialog mode="edit" skill={form} />
                  <DeleteSkillButton id={skill.id} name={skill.name} />
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
