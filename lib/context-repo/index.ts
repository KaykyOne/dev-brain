import "server-only";

import { join, resolve } from "node:path";

import { revalidateTag } from "next/cache";

import { env } from "@/lib/env";

import {
  archiveRepo,
  initRepo,
  isRepo,
  listFiles,
  readRepoFile,
  repoDir,
  repoCommitDates,
  repoHistory,
  repoLog,
  repoSummary,
  writeRepoFile,
  type TemplateVars,
} from "./repo";

export { RepoError } from "./repo";

const root = () => resolve(env.CONTEXT_REPOS_DIR);
const templateDir = () => join(process.cwd(), "templates", "context");

/** Descarta o cache de leituras git do projeto (tag `repo:<slug>`, ver lib/projects/repo-info). */
const invalidate = (slug: string) => revalidateTag(`repo:${slug}`, { expire: 0 });

/** Operações de repositório de contexto ligadas à configuração do app (CONTEXT_REPOS_DIR). */
export const contextRepos = {
  root,
  dir: (slug: string) => repoDir(root(), slug),
  exists: (slug: string) => isRepo(repoDir(root(), slug)),
  init: async (vars: TemplateVars, branch: string) => {
    const result = await initRepo({ root: root(), templateDir: templateDir(), vars, branch });
    if (result.created) invalidate(vars.slug);
    return result;
  },
  files: (slug: string) => listFiles(repoDir(root(), slug)),
  read: (slug: string, path: string) => readRepoFile(repoDir(root(), slug), path),
  write: async (slug: string, path: string, content: string, options: { message: string; author?: string }) => {
    const result = await writeRepoFile(repoDir(root(), slug), path, content, options);
    if (result.changed) invalidate(slug);
    return result;
  },
  log: (slug: string, limit?: number) => repoLog(repoDir(root(), slug), limit),
  history: (slug: string, limit?: number) => repoHistory(repoDir(root(), slug), limit),
  commitDates: (slug: string, days: number) => repoCommitDates(repoDir(root(), slug), days),
  summary: (slug: string) => repoSummary(repoDir(root(), slug)),
  archive: async (slug: string) => {
    const target = await archiveRepo(root(), slug);
    invalidate(slug);
    return target;
  },
};
