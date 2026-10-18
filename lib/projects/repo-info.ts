import "server-only";

import type { Project } from "@/db/schema";
import { contextRepos } from "@/lib/context-repo";
import type { CommitInfo } from "@/lib/context-repo/repo";
import { logger } from "@/lib/logger";

type RepoRef = Pick<Project, "name" | "slug" | "description" | "defaultBranch">;

/** Garante o repositório (projetos anteriores ao hub ganham o dele no primeiro acesso). */
function ensure(project: RepoRef) {
  return contextRepos.init(
    { name: project.name, slug: project.slug, description: project.description },
    project.defaultBranch,
  );
}

/** Estado do repositório de um projeto, ou null se o git não estiver acessível. */
export async function getRepoInfo(project: RepoRef) {
  try {
    await ensure(project);
    const [files, summary] = await Promise.all([contextRepos.files(project.slug), contextRepos.summary(project.slug)]);
    return { files, commits: summary.commits, head: summary.head };
  } catch (error) {
    await logger.warn("projects", `Repositório de contexto indisponível ("${project.slug}")`, { error });
    return null;
  }
}

/** Resumo leve de vários projetos para listas e dashboard. */
export async function getRepoSummaries(list: RepoRef[]) {
  const entries = await Promise.all(
    list.map(async (project) => {
      const info = await getRepoInfo(project);
      return [project.slug, info] as const;
    }),
  );
  return new Map(entries);
}

export async function getRecentCommits(list: RepoRef[], limit: number): Promise<(CommitInfo & { project: RepoRef })[]> {
  const perProject = await Promise.all(
    list.map(async (project) => {
      try {
        await ensure(project);
        return (await contextRepos.log(project.slug, limit)).map((commit) => ({ ...commit, project }));
      } catch {
        return [];
      }
    }),
  );

  return perProject
    .flat()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}
