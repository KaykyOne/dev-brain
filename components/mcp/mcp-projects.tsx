import Link from "next/link";
import { FolderIcon } from "lucide-react";

import { ProjectActiveToggle } from "@/components/projects/project-active-toggle";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";

type McpProjectsProps = {
  projects: { id: string; name: string; slug: string; active: boolean }[];
};

/** Quais projetos o MCP atende: ativos respondem às ferramentas, desativados devolvem um aviso ao agente. */
export function McpProjects({ projects }: McpProjectsProps) {
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderIcon}
        title="Nenhum projeto"
        description="Crie um projeto (ou peça ao agente: create_project) para ele aparecer aqui."
      />
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {projects.map((project) => (
        <li key={project.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/projects/${project.slug}`} className="truncate font-medium hover:underline">
                {project.name}
              </Link>
              <Badge variant={project.active ? "secondary" : "outline"}>
                {project.active ? "Acessível" : "Desativado"}
              </Badge>
            </div>
            <p className="font-mono text-xs text-muted-foreground">project: &quot;{project.slug}&quot;</p>
          </div>
          <ProjectActiveToggle id={project.id} active={project.active} size="sm" />
        </li>
      ))}
    </ul>
  );
}
