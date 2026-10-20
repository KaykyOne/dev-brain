import "server-only";

import { join, resolve } from "node:path";

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

/** Operações de repositório de contexto ligadas à configuração do app (CONTEXT_REPOS_DIR). */
export const contextRepos = {
  root,
  dir: (slug: string) => repoDir(root(), slug),
  exists: (slug: string) => isRepo(repoDir(root(), slug)),
  init: (vars: TemplateVars, branch: string) => initRepo({ root: root(), templateDir: templateDir(), vars, branch }),
  files: (slug: string) => listFiles(repoDir(root(), slug)),
  read: (slug: string, path: string) => readRepoFile(repoDir(root(), slug), path),
  write: (slug: string, path: string, content: string, options: { message: string; author?: string }) =>
    writeRepoFile(repoDir(root(), slug), path, content, options),
  log: (slug: string, limit?: number) => repoLog(repoDir(root(), slug), limit),
  history: (slug: string, limit?: number) => repoHistory(repoDir(root(), slug), limit),
  commitDates: (slug: string, days: number) => repoCommitDates(repoDir(root(), slug), days),
  summary: (slug: string) => repoSummary(repoDir(root(), slug)),
  archive: (slug: string) => archiveRepo(root(), slug),
};
