import { execFile } from "node:child_process";
import { cp, lstat, mkdir, readdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { normalizeRelativePath } from "@/lib/security/paths";
import { SLUG_PATTERN } from "@/lib/slug";

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT_MS = 20_000;
export const MAX_FILE_BYTES = 500_000;
export const INITIAL_COMMIT = "feat: estrutura inicial do context";

// Extensões que o hub aceita escrever (contexto, notas, tasks e scripts de verificação).
const WRITABLE_EXTENSIONS = new Set([".md", ".txt", ".json", ".yaml", ".yml", ".py"]);
const TEXT_EXTENSIONS = new Set([...WRITABLE_EXTENSIONS, ".gitkeep"]);

export class RepoError extends Error {}

export type TemplateVars = { name: string; slug: string; description: string };
export type CommitInfo = { sha: string; author: string; date: string; subject: string };

/** Pasta do repositório de um projeto. O slug é validado para nunca escapar de `root`. */
export function repoDir(root: string, slug: string): string {
  if (!SLUG_PATTERN.test(slug)) throw new RepoError("Slug inválido para repositório");
  return join(resolve(root), slug);
}

async function git(dir: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: dir,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
    });
    return stdout;
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim();
    throw new RepoError(stderr || (error as Error).message);
  }
}

// Serializa as operações por repositório: dois commits simultâneos disputariam o index.lock.
const locks = new Map<string, Promise<unknown>>();

function withLock<T>(dir: string, task: () => Promise<T>): Promise<T> {
  const run = (locks.get(dir) ?? Promise.resolve()).then(task, task);
  const tail = run.catch(() => undefined);
  locks.set(dir, tail);
  void tail.then(() => {
    if (locks.get(dir) === tail) locks.delete(dir);
  });
  return run;
}

export async function isRepo(dir: string): Promise<boolean> {
  try {
    return (await stat(join(dir, ".git"))).isDirectory();
  } catch {
    return false;
  }
}

function render(content: string, vars: TemplateVars): string {
  const values: Record<string, string> = {
    name: vars.name,
    slug: vars.slug,
    description: vars.description.trim() || "Descreva aqui o que o projeto faz e para quem.",
  };
  return content.replace(/\{\{(name|slug|description)\}\}/g, (_, key: string) => values[key]);
}

async function renderTree(from: string, to: string, vars: TemplateVars) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) {
      await renderTree(source, target, vars);
    } else if (entry.isFile()) {
      if (TEXT_EXTENSIONS.has(extname(entry.name) || entry.name)) {
        await writeFile(target, render(await readFile(source, "utf8"), vars));
      } else {
        await cp(source, target);
      }
    }
  }
}

/**
 * Cria o repositório do projeto a partir do template e faz o commit inicial.
 * Se a pasta já for um repositório, ela é adotada sem alterações (`created: false`).
 */
export async function initRepo(options: {
  root: string;
  templateDir: string;
  vars: TemplateVars;
  branch: string;
}): Promise<{ created: boolean; dir: string }> {
  const dir = repoDir(options.root, options.vars.slug);

  return withLock(dir, async () => {
    if (await isRepo(dir)) return { created: false, dir };

    await mkdir(dirname(dir), { recursive: true });
    await renderTree(options.templateDir, dir, options.vars);

    await git(dir, ["init", "--initial-branch", options.branch]);
    await git(dir, ["config", "user.name", "DevBrain"]);
    await git(dir, ["config", "user.email", "devbrain@localhost"]);
    // O hub nunca publica: sem remoto e com push desabilitado também no nível do git.
    await git(dir, ["config", "remote.pushDefault", "none"]);
    await git(dir, ["add", "--all"]);
    await git(dir, ["commit", "-m", INITIAL_COMMIT]);

    return { created: true, dir };
  });
}

/** Valida o caminho vindo do usuário/agente e devolve o caminho absoluto dentro do repositório. */
export async function resolveInRepo(dir: string, input: string, options: { forWrite?: boolean } = {}) {
  const path = normalizeRelativePath(input);
  if (!path) throw new RepoError("Caminho relativo inválido");
  if (path.split("/").some((segment) => segment === ".git")) throw new RepoError("Acesso à pasta .git não permitido");
  if (options.forWrite && !WRITABLE_EXTENSIONS.has(extname(path).toLowerCase())) {
    throw new RepoError(`Extensão não permitida. Use: ${[...WRITABLE_EXTENSIONS].join(", ")}`);
  }

  const absolute = join(resolve(dir), path);

  // Defesa contra symlinks: o pai existente mais próximo precisa estar dentro do repositório.
  const realRoot = await realpath(dir);
  let ancestor = dirname(absolute);
  while (true) {
    try {
      const real = await realpath(ancestor);
      if (real !== realRoot && !real.startsWith(realRoot + sep)) throw new RepoError("Caminho fora do repositório");
      break;
    } catch (error) {
      if (error instanceof RepoError) throw error;
      const parent = dirname(ancestor);
      if (parent === ancestor) throw new RepoError("Caminho fora do repositório");
      ancestor = parent;
    }
  }

  return { path, absolute };
}

export async function listFiles(dir: string): Promise<string[]> {
  const output = await git(dir, ["ls-files", "-z"]);
  return output.split("\0").filter(Boolean).sort();
}

export async function readRepoFile(dir: string, input: string): Promise<{ path: string; content: string }> {
  const { path, absolute } = await resolveInRepo(dir, input);

  let info;
  try {
    info = await lstat(absolute);
  } catch {
    throw new RepoError("Arquivo não encontrado");
  }
  if (!info.isFile()) throw new RepoError("O caminho não é um arquivo");
  if (info.size > MAX_FILE_BYTES) throw new RepoError("Arquivo grande demais para leitura");

  return { path, content: await readFile(absolute, "utf8") };
}

function sanitizeIdentity(value: string): string {
  return value.replace(/[<>\r\n\0]/g, " ").trim().slice(0, 60) || "agent";
}

/** Grava o arquivo e cria um commit só com ele. `changed: false` quando o conteúdo já era idêntico. */
export async function writeRepoFile(
  dir: string,
  input: string,
  content: string,
  options: { message: string; author?: string },
): Promise<{ path: string; changed: boolean; sha: string | null; created: boolean }> {
  const message = options.message.trim();
  if (!message || message.length > 200 || /[\r\n\0]/.test(message)) {
    throw new RepoError("Mensagem de commit inválida: use uma linha de até 200 caracteres");
  }
  if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new RepoError("Conteúdo grande demais");

  return withLock(dir, async () => {
    const { path, absolute } = await resolveInRepo(dir, input, { forWrite: true });

    let previous: string | null = null;
    try {
      const info = await lstat(absolute);
      if (!info.isFile()) throw new RepoError("O caminho não é um arquivo");
      previous = await readFile(absolute, "utf8");
    } catch (error) {
      if (error instanceof RepoError) throw error;
    }

    if (previous === content) return { path, changed: false, sha: null, created: false };

    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, content);

    const identity = sanitizeIdentity(options.author ?? "DevBrain");
    await git(dir, ["add", "--", path]);
    await git(dir, [
      "commit",
      "--author",
      `${identity} <agent@devbrain.local>`,
      "-m",
      message,
      "--only",
      "--",
      path,
    ]);

    return { path, changed: true, sha: (await git(dir, ["rev-parse", "HEAD"])).trim(), created: previous === null };
  });
}

export async function repoLog(dir: string, limit = 20): Promise<CommitInfo[]> {
  const count = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const output = await git(dir, ["log", `-n${count}`, "--format=%H%x1f%an%x1f%aI%x1f%s"]);
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, author, date, subject] = line.split("\x1f");
      return { sha, author, date, subject };
    });
}

export async function repoSummary(dir: string) {
  const [commits, [head]] = await Promise.all([
    git(dir, ["rev-list", "--count", "HEAD"]),
    repoLog(dir, 1),
  ]);
  return { commits: Number(commits.trim()), head: head ?? null };
}

/** Move o repositório para `.trash/` em vez de apagá-lo: remover um projeto não destrói o histórico. */
export async function archiveRepo(root: string, slug: string): Promise<string | null> {
  const dir = repoDir(root, slug);
  if (!(await isRepo(dir))) return null;

  const trash = join(resolve(root), ".trash");
  await mkdir(trash, { recursive: true });
  const target = join(trash, `${slug}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  await rename(dir, target);
  return target;
}
