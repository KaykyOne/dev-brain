import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { ImportSkillsDialog } from "@/components/skills/import-skills-dialog";
import { SkillDialog } from "@/components/skills/skill-dialog";
import { ProjectSkills, UniversalSkills, type ProjectSkillGroup } from "@/components/skills/skills-explorer";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth/dal";
import { listProjects } from "@/lib/projects/queries";
import { listAllProjectSkills, listUniversalSkills } from "@/lib/skills/queries";

export const metadata: Metadata = { title: "Skills" };

export default async function SkillsPage() {
  const user = await getCurrentUser();
  const [projects, universal, projectSkills] = await Promise.all([
    listProjects(user.id),
    listUniversalSkills(user.id),
    listAllProjectSkills(user.id),
  ]);

  // Agrupa por projeto mantendo a ordem da consulta.
  const groups = new Map<string, ProjectSkillGroup>();
  for (const { skill, project } of projectSkills) {
    const { id, name, slug, repositoryPath } = project;
    const group = groups.get(id) ?? { project: { id, name, slug, repositoryPath }, skills: [] };
    group.skills.push(skill);
    groups.set(id, group);
  }

  return (
    <>
      <PageHeader
        title="Skills"
        description="Instruções reutilizáveis que seus agentes descobrem pelo MCP."
        actions={
          <>
            <ImportSkillsDialog projectId={null} projects={projects.map(({ id, name }) => ({ id, name }))} />
            <SkillDialog mode="create" projectId={null} projects={projects.map(({ id, name }) => ({ id, name }))} />
          </>
        }
      />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Universais</h2>
          <Badge variant="secondary">{universal.length}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Valem para todos os projetos automaticamente, sem precisar anexar.
        </p>
        <UniversalSkills skills={universal} />
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Por projeto</h2>
          <p className="text-sm text-muted-foreground">Específicas de um projeto; valem só para ele.</p>
        </div>
        <ProjectSkills groups={[...groups.values()]} />
      </section>
    </>
  );
}
