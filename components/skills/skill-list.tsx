import { SparklesIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import type { Skill } from "@/db/schema";
import { skillRepoPath } from "@/lib/skills/paths";

import { DeleteSkillButton } from "./delete-skill-button";
import { SkillDialog } from "./skill-dialog";

type SkillListProps = {
  skills: Skill[];
  project?: { slug: string; repositoryPath: string | null } | null;
  /** Universais exibidas em projetos são somente leitura (gerenciadas em /skills). */
  readOnly?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
};

export function SkillList({ skills, project = null, readOnly = false, emptyTitle, emptyDescription }: SkillListProps) {
  if (skills.length === 0) {
    return <EmptyState icon={SparklesIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="divide-y rounded-lg border">
      {skills.map((skill) => (
        <li key={skill.id} className="flex items-start justify-between gap-4 px-4 py-3">
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{skill.name}</p>
            <p className="text-sm text-muted-foreground">{skill.description}</p>
            <p className="text-xs text-muted-foreground">
              {skill.content ? `SKILL.md armazenado · ${skill.content.split("\n").length} linhas` : "Sem arquivo SKILL.md"}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">{skillRepoPath({ slug: skill.slug, project })}</p>
          </div>
          {!readOnly && (
            <div className="flex shrink-0 items-center">
              <SkillDialog mode="edit" skill={{ id: skill.id, name: skill.name, description: skill.description, content: skill.content ?? "" }} />
              <DeleteSkillButton id={skill.id} name={skill.name} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
