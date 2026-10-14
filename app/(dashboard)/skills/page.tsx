import type { Metadata } from "next";
import Link from "next/link";

import { ImportSkillsDialog } from "@/components/skills/import-skills-dialog";
import { SkillDialog } from "@/components/skills/skill-dialog";
import { SkillList } from "@/components/skills/skill-list";
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
  const groups = new Map<string, { project: (typeof projectSkills)[number]["project"]; skills: (typeof universal) }>();
  for (const { skill, project } of projectSkills) {
    const group = groups.get(project.id) ?? { project, skills: [] };
    group.skills.push(skill);
    groups.set(project.id, group);
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Skills</h1>
          <p className="text-sm text-muted-foreground">
            Instruções reutilizáveis que seus agentes descobrem pelo MCP.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <ImportSkillsDialog projectId={null} projects={projects.map(({ id, name }) => ({ id, name }))} />
          <SkillDialog mode="create" projectId={null} projects={projects.map(({ id, name }) => ({ id, name }))} />
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Universais</h2>
          <Badge variant="secondary">{universal.length}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Valem para todos os projetos automaticamente, sem precisar anexar.
        </p>
        <SkillList
          skills={universal}
          emptyTitle="Nenhuma skill universal"
          emptyDescription="Crie skills que se aplicam a qualquer projeto, como “Revisar código” ou “Preparar Pull Request”."
        />
      </section>

      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Por projeto</h2>
          <p className="text-sm text-muted-foreground">Específicas de um projeto; valem só para ele.</p>
        </div>
        {groups.size === 0 ? (
          <SkillList
            skills={[]}
            emptyTitle="Nenhuma skill de projeto"
            emptyDescription="Adicione ao cadastrar um projeto ou na aba Skills dele."
          />
        ) : (
          [...groups.values()].map(({ project, skills }) => (
            <div key={project.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Link href={`/projects/${project.slug}`} className="font-medium hover:underline">
                  {project.name}
                </Link>
                <Badge variant="outline">{skills.length}</Badge>
              </div>
              <SkillList skills={skills} project={project} emptyTitle="" />
            </div>
          ))
        )}
      </section>
    </>
  );
}
