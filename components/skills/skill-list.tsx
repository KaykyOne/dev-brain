import { SparklesIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Highlight, MARK_CLASS } from "@/components/shared/highlight";
import type { Skill } from "@/db/schema";
import { skillRepoPath } from "@/lib/skills/paths";
import { includesText } from "@/lib/skills/search";

import { DeleteSkillButton } from "./delete-skill-button";
import { PromoteSkillDialog } from "./promote-skill-dialog";
import { SkillDialog } from "./skill-dialog";
import { SkillViewDialog } from "./skill-view-dialog";

type SkillListProps = {
  skills: Skill[];
  /** Projeto dono das skills (define o caminho no repositório). Ausente = skills universais. */
  project?: { name?: string; slug: string; repositoryPath: string | null } | null;
  /** Universais exibidas em projetos são somente leitura (gerenciadas em /skills). */
  readOnly?: boolean;
  /** Termo da busca: grifa onde ele aparece (título e descrição; no conteúdo, o caminho). */
  query?: string;
  emptyTitle: string;
  emptyDescription?: string;
};

export function SkillList({
  skills,
  project = null,
  readOnly = false,
  query,
  emptyTitle,
  emptyDescription,
}: SkillListProps) {
  if (skills.length === 0) {
    return <EmptyState icon={SparklesIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="divide-y rounded-lg border">
      {skills.map((skill) => {
        const path = skillRepoPath({ slug: skill.slug, project });
        const foundInContent = !!query && !!skill.content && includesText(skill.content, query);

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
            </div>

            <div className="flex shrink-0 items-center">
              <SkillViewDialog name={skill.name} description={skill.description} path={path} content={skill.content} />
              {!readOnly && (
                <>
                  {project && (
                    <PromoteSkillDialog
                      projectName={project.name}
                      skill={{ id: skill.id, name: skill.name, description: skill.description, content: skill.content ?? "" }}
                    />
                  )}
                  <SkillDialog
                    mode="edit"
                    skill={{ id: skill.id, name: skill.name, description: skill.description, content: skill.content ?? "" }}
                  />
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
