import type { Metadata } from "next";
import Link from "next/link";

import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog";
import { FileList } from "@/components/projects/file-list";
import { ProjectForm } from "@/components/projects/project-form";
import { ImportSkillsDialog } from "@/components/skills/import-skills-dialog";
import { SkillDialog } from "@/components/skills/skill-dialog";
import { SkillList } from "@/components/skills/skill-list";
import { ProposalTable } from "@/components/projects/proposal-table";
import { SyncStatusBadge } from "@/components/projects/sync-status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";
import { getProjectDetail } from "@/lib/projects/queries";
import { listProjectSkills, listUniversalSkills } from "@/lib/skills/queries";

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const { project, files, proposals, pendingCount, lastSync } = await getProjectDetail(user.id, slug);
  const [universalSkills, projectSkills] = await Promise.all([
    listUniversalSkills(user.id),
    listProjectSkills(project.id),
  ]);

  const byCategory = (...categories: string[]) => files.filter((file) => categories.includes(file.category));

  const overview = [
    ["Repositório", project.repositoryId ? "Vinculado" : "Não vinculado"],
    ["Caminho", project.repositoryPath ?? "—"],
    ["Branch principal", project.defaultBranch],
    ["Última sincronização", project.lastSyncedAt ? formatDateTime(project.lastSyncedAt) : "Nunca"],
    ["Arquivos de contexto", String(files.length)],
    ["Skills", `${universalSkills.length} universais · ${projectSkills.length} do projeto`],
    ["Alterações pendentes", String(pendingCount)],
  ];

  return (
    <>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <SyncStatusBadge status={project.syncStatus} />
        </div>
        <p className="font-mono text-xs text-muted-foreground">{project.slug}</p>
        {project.description && <p className="max-w-2xl text-sm text-muted-foreground">{project.description}</p>}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="contexts">Contextos</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="memory">Memória</TabsTrigger>
          <TabsTrigger value="decisions">Decisões</TabsTrigger>
          <TabsTrigger value="changes">Alterações</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {overview.map(([label, value]) => (
              <div key={label} className="rounded-lg border p-4">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 truncate font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {lastSync?.status === "failed" && (
            <p className="mt-4 text-sm text-destructive">A última sincronização falhou.</p>
          )}
        </TabsContent>

        <TabsContent value="contexts" className="pt-4">
          <FileList files={byCategory("context", "architecture", "rule")} emptyTitle="Nenhum contexto sincronizado" />
        </TabsContent>
        <TabsContent value="skills" className="space-y-8 pt-4">
          <section className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">Deste projeto</h2>
                <p className="text-sm text-muted-foreground">Valem só para {project.name}.</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <ImportSkillsDialog projectId={project.id} />
                <SkillDialog mode="create" projectId={project.id} />
              </div>
            </div>
            <SkillList
              skills={projectSkills}
              project={project}
              emptyTitle="Nenhuma skill específica"
              emptyDescription="Crie skills para procedimentos próprios deste projeto."
            />
          </section>
          <section className="space-y-3">
            <div>
              <h2 className="font-semibold">Universais</h2>
              <p className="text-sm text-muted-foreground">
                Aplicadas a todos os projetos. Gerencie em <Link href="/skills" className="underline">Skills</Link>.
              </p>
            </div>
            <SkillList
              skills={universalSkills}
              readOnly
              emptyTitle="Nenhuma skill universal"
              emptyDescription="Skills universais criadas em Skills aparecem aqui automaticamente."
            />
          </section>
        </TabsContent>
        <TabsContent value="memory" className="pt-4">
          <FileList files={byCategory("memory")} emptyTitle="Nenhuma memória registrada" />
        </TabsContent>
        <TabsContent value="decisions" className="pt-4">
          <FileList files={byCategory("decision")} emptyTitle="Nenhuma decisão documentada" />
        </TabsContent>
        <TabsContent value="changes" className="pt-4">
          <ProposalTable proposals={proposals} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-8 pt-4">
          <ProjectForm
            project={{
              id: project.id,
              name: project.name,
              slug: project.slug,
              description: project.description,
              repositoryPath: project.repositoryPath ?? "",
              defaultBranch: project.defaultBranch,
            }}
          />
          <div className="max-w-xl space-y-3 rounded-lg border border-destructive/30 p-4">
            <div>
              <p className="font-medium">Zona de perigo</p>
              <p className="text-sm text-muted-foreground">Remove o projeto e seus metadados do DevBrain.</p>
            </div>
            <DeleteProjectDialog id={project.id} name={project.name} />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
