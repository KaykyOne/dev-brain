import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { TaskBoard } from "@/components/tasks/task-board";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/dal";
import { listTaskProjects, listTasks } from "@/lib/tasks/service";

export const metadata: Metadata = { title: "Tarefas" };

const DESCRIPTION = (
  <>
    Fila de tarefas para o Claude Code e o Codex. A extensão Agent Tasks do VS Code pega a próxima da fila, executa numa
    branch e reporta o resultado aqui.
  </>
);

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <Suspense fallback={<TasksSkeleton />}>
      <Tasks searchParams={searchParams} />
    </Suspense>
  );
}

async function Tasks({ searchParams }: Pick<PageProps<"/tasks">, "searchParams">) {
  const user = await getCurrentUser();

  const raw = await searchParams;
  const projectParam = typeof raw.project === "string" ? raw.project : undefined;
  const selectedId = typeof raw.task === "string" ? raw.task : undefined;

  const projects = await listTaskProjects(user.id);
  const project = projects.some((p) => p.slug === projectParam) ? projectParam : undefined;
  const tasks = await listTasks(user.id, { projects: project ? [project] : undefined });

  return (
    <>
      <PageHeader title="Tarefas" description={DESCRIPTION} actions={<NewTaskDialog projects={projects} defaultProject={project} />} />
      <TaskBoard tasks={tasks} projects={projects} project={project} selectedId={selectedId} />
    </>
  );
}

function TasksSkeleton() {
  return (
    <>
      <PageHeader title="Tarefas" description={DESCRIPTION} actions={<Skeleton className="h-8 w-32" />} />
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[70px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[76px] rounded-xl" />
        ))}
      </div>
    </>
  );
}
