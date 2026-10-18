import { FolderGitIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";
import { listProjects } from "@/lib/projects/queries";
import { getRepoSummaries } from "@/lib/projects/repo-info";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Projetos" };

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  const projects = await listProjects(user.id);
  const repos = await getRepoSummaries(projects);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
          <p className="text-sm text-muted-foreground">Cada projeto é um repositório git de contexto no padrão do hub.</p>
        </div>
        <Link href="/projects/new" className={cn(buttonVariants())}>
          <PlusIcon /> Novo projeto
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderGitIcon}
          title="Nenhum projeto ainda"
          description="Crie seu primeiro projeto para organizar contextos, skills e memórias dos seus agentes."
        >
          <Link href="/projects/new" className={cn(buttonVariants())}>
            <PlusIcon /> Criar projeto
          </Link>
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const repo = repos.get(project.slug);
            return (
              <Link key={project.id} href={`/projects/${project.slug}`} className="group">
                <Card className="h-full transition-colors group-hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription className="font-mono text-xs">{project.slug}</CardDescription>
                    {project.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
                    )}
                    <div className="flex items-center justify-between gap-2 pt-2">
                      <Badge variant="secondary">
                        {repo ? `${repo.commits} commits · ${repo.files.length} arquivos` : "Repositório indisponível"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {repo?.head ? formatDateTime(repo.head.date) : "—"}
                      </span>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
