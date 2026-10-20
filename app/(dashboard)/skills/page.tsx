import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { ImportSkillsDialog } from "@/components/skills/import-skills-dialog";
import { SkillDialog } from "@/components/skills/skill-dialog";
import { LibrarySkills, ProjectSkills, UniversalSkills, type ProjectSkillGroup } from "@/components/skills/skills-explorer";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth/dal";
import { listProjects } from "@/lib/projects/queries";
import { listAllProjectSkills, listLibrarySkills, listUniversalSkills } from "@/lib/skills/queries";

export const metadata: Metadata = { title: "Skills" };

export default async function SkillsPage() {
  const user = await getCurrentUser();
  const [projects, universal, library, projectSkills] = await Promise.all([
    listProjects(user.id),
    listUniversalSkills(user.id),
    listLibrarySkills(user.id),
    listAllProjectSkills(user.id),
  ]);

  const projectRefs = projects.map(({ id, name }) => ({ id, name }));

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
            <ImportSkillsDialog target="universal" projects={projectRefs} />
            <SkillDialog mode="create" target="universal" projects={projectRefs} />
          </>
        }
      />

      <Tabs defaultValue="universal">
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="universal">
              Universais <Badge variant="secondary">{universal.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="library">
              Biblioteca <Badge variant="secondary">{library.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="projects">
              Por projeto <Badge variant="secondary">{projectSkills.length}</Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="universal" className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">Valem para todos os projetos automaticamente, sem precisar aplicar.</p>
          <UniversalSkills skills={universal} />
        </TabsContent>

        <TabsContent value="library" className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">
            Skills genéricas reutilizáveis (por exemplo, o seu fluxo de autodeploy). Crie uma vez e aplique só aos
            projetos que as usam: o conteúdo fica em um lugar só e editar atualiza todos eles.
          </p>
          <LibrarySkills skills={library} projects={projectRefs} />
        </TabsContent>

        <TabsContent value="projects" className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">Específicas de um projeto; valem só para ele.</p>
          <ProjectSkills groups={[...groups.values()]} allProjects={projectRefs} />
        </TabsContent>
      </Tabs>
    </>
  );
}
