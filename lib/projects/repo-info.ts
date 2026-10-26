import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { Project } from "@/db/schema";
import { contextRepos } from "@/lib/context-repo";
import type { CommitInfo } from "@/lib/context-repo/repo";
import { dayKey } from "@/lib/format";
import { logger } from "@/lib/logger";

type RepoRef = Pick<Project, "name" | "slug" | "description" | "defaultBranch">;

/** Tag de cache dos dados git de um projeto; invalidada quando o repositório muda (ver lib/context-repo). */
export const repoTag = (slug: string) => `repo:${slug}`;

// Os repositórios só mudam pelo próprio app (que invalida a tag), então o cache é longo.
// `stale` curto: o cache do navegador não segura uma página por muito tempo depois de uma escrita.
const REPO_CACHE = { stale: 30, revalidate: 900, expire: 86_400 };

// Slugs já confirmados: evita o stat + lock do `init` a cada leitura.
const ensured = new Set<string>();

/** Garante o repositório (projetos anteriores ao hub ganham o dele no primeiro acesso). */
async function ensure(project: RepoRef) {
  if (ensured.has(project.slug)) return;
  await contextRepos.init(
    { name: project.name, slug: project.slug, description: project.description },
    project.defaultBranch,
  );
  ensured.add(project.slug);
}

// Leituras de git em cache: cada miss custa vários processos `git`, então só rodam depois de uma escrita.
// Falhas lançam (e não são cacheadas); os chamadores decidem o fallback.
async function cachedSummary(slug: string, name: string, description: string, defaultBranch: string) {
  "use cache";
  cacheLife(REPO_CACHE);
  cacheTag(repoTag(slug));

  await ensure({ name, slug, description, defaultBranch });
  const [files, summary] = await Promise.all([contextRepos.files(slug), contextRepos.summary(slug)]);
  return { files, commits: summary.commits, head: summary.head };
}

async function cachedLog(slug: string, name: string, description: string, defaultBranch: string, limit: number) {
  "use cache";
  cacheLife(REPO_CACHE);
  cacheTag(repoTag(slug));

  await ensure({ name, slug, description, defaultBranch });
  return contextRepos.log(slug, limit);
}

async function cachedHistory(slug: string, name: string, description: string, defaultBranch: string, limit: number) {
  "use cache";
  cacheLife(REPO_CACHE);
  cacheTag(repoTag(slug));

  await ensure({ name, slug, description, defaultBranch });
  return contextRepos.history(slug, limit);
}

async function cachedCommitDates(slug: string, name: string, description: string, defaultBranch: string, days: number) {
  "use cache";
  // Janela por dia: vida curta para o gráfico acompanhar a virada de dia.
  cacheLife({ ...REPO_CACHE, revalidate: 600 });
  cacheTag(repoTag(slug));

  await ensure({ name, slug, description, defaultBranch });
  return contextRepos.commitDates(slug, days);
}

/** Estado do repositório de um projeto, ou null se o git não estiver acessível. */
export async function getRepoInfo(project: RepoRef) {
  try {
    return await cachedSummary(project.slug, project.name, project.description, project.defaultBranch);
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
        const log = await cachedLog(project.slug, project.name, project.description, project.defaultBranch, limit);
        return log.map((commit) => ({ ...commit, project }));
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

/** Histórico de um projeto para a aba Commits (a lista pagina no cliente). */
export async function getCommitHistory(project: RepoRef, limit = 100): Promise<CommitInfo[]> {
  try {
    return await cachedHistory(project.slug, project.name, project.description, project.defaultBranch, limit);
  } catch (error) {
    await logger.warn("projects", `Histórico indisponível ("${project.slug}")`, { error });
    return [];
  }
}

export type CommitActivity = {
  /** Dias (AAAA-MM-DD), do mais antigo ao de hoje. */
  days: string[];
  series: { slug: string; name: string; total: number; counts: number[] }[];
};

/** Commits por dia e por projeto nos últimos `days` dias (inclui hoje). */
export async function getCommitActivity(list: RepoRef[], days: number, now = new Date()): Promise<CommitActivity> {
  const keys = Array.from({ length: days }, (_, index) => dayKey(new Date(now.getTime() - (days - 1 - index) * 86_400_000)));
  const position = new Map(keys.map((key, index) => [key, index]));

  const series = await Promise.all(
    list.map(async (project) => {
      const counts = Array<number>(days).fill(0);
      try {
        const dates = await cachedCommitDates(project.slug, project.name, project.description, project.defaultBranch, days + 1);
        for (const date of dates) {
          const index = position.get(dayKey(date));
          if (index !== undefined) counts[index] += 1;
        }
      } catch {
        // Repositório indisponível: a série fica zerada.
      }
      return { slug: project.slug, name: project.name, counts, total: counts.reduce((sum, value) => sum + value, 0) };
    }),
  );

  return { days: keys, series: series.sort((a, b) => b.total - a.total) };
}
