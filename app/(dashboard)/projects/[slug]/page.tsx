import type { Metadata } from "next";
import Link from "next/link";

import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog";
import { RepoFiles } from "@/components/projects/repo-files";
import { ProjectForm } from "@/components/projects/project-form";
import { ImportSkillsDialog } from "@/components/skills/import-skills-dialog";
import { SkillDialog } from "@/components/skills/skill-dialog";
import { SkillList } from "@/components/skills/skill-list";
import { ProposalTable } from "@/components/projects/proposal-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatDateTime, shortSha } from "@/lib/format";
import { getProjectDetail } from "@/lib/projects/queries";
import { getRepoInfo } from "@/lib/projects/repo-info";
import { listProjectSkills, listUniversalSkills } from "@/lib/skills/queries";

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const { project, proposals, pendingCount } = await getProjectDetail(user.id, slug);
  const [universalSkills, projectSkills, repo] = await Promise.all([
    listUniversalSkills(user.id),
    listProjectSkills(project.id),
    getRepoInfo(project),
  ]);

  const overview = [
    ["Repositório git", repo ? "Local, sem remoto (sem push)" : "Indisponível"],
    ["Branch principal", project.defaultBranch],
    ["Commits", repo ? String(repo.commits) : "—"],
    ["Último commit", repo?.head ? `${shortSha(repo.head.sha)} · ${formatDateTime(repo.head.date)}` : "—"],
    ["Arquivos versionados", repo ? String(repo.files.length) : "—"],
    ["Skills", `${universalSkills.length} universais · ${projectSkills.length} do projeto`],
    ["Alterações pendentes", String(pendingCount)],
  ];

  return (
    <>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        </div>
        <p className="font-mono text-xs text-muted-foreground">{project.slug}</p>
        {project.description && <p className="max-w-2xl text-sm text-muted-foreground">{project.description}</p>}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="files">Arquivos</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
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
          {!repo && (
            <p className="mt-4 text-sm text-destructive">
              Não foi possível acessar o repositório git deste projeto. Verifique o volume em CONTEXT_REPOS_DIR.
            </p>
          )}
        </TabsContent>

        <TabsContent value="files" className="pt-4">
          <RepoFiles slug={project.slug} files={repo?.files ?? []} />
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
              <p className="text-sm text-muted-foreground">Remove o projeto do DevBrain. O repositório git é preservado em .trash/ no volume de repositórios.</p>
            </div>
            <DeleteProjectDialog id={project.id} name={project.name} />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
