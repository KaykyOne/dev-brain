import { FolderGitIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SyncStatusBadge } from "@/components/projects/sync-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";
import { listProjects } from "@/lib/projects/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Projetos" };

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  const projects = await listProjects(user.id);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
          <p className="text-sm text-muted-foreground">Projetos com contexto gerenciado pelo DevBrain.</p>
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
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.slug}`} className="group">
              <Card className="h-full transition-colors group-hover:bg-muted/50">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription className="font-mono text-xs">{project.slug}</CardDescription>
                  {project.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-2">
                    <SyncStatusBadge status={project.syncStatus} />
                    <span className="text-xs text-muted-foreground">
                      {project.lastSyncedAt ? formatDateTime(project.lastSyncedAt) : "—"}
                    </span>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
