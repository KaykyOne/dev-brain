import { execFile } from "node:child_process";
import { access, constants, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const errorCode = (error: unknown) => (error as { code?: string } | null)?.code ?? "erro desconhecido";

/**
 * Confere o que a criação de repositórios de contexto exige: git instalado e a pasta raiz criável e gravável.
 * Serve para acusar o problema na subida do servidor, e não só quando o usuário cria um projeto.
 */
export async function checkContextRepos(root: string): Promise<{ dir: string; problems: string[] }> {
  const dir = resolve(root);
  const problems: string[] = [];

  try {
    await execFileAsync("git", ["--version"], { timeout: 5_000 });
  } catch {
    problems.push("git não está instalado ou não está no PATH");
  }

  try {
    await mkdir(dir, { recursive: true });
    await access(dir, constants.W_OK);
  } catch (error) {
    problems.push(`sem permissão para criar/gravar em ${dir} (${errorCode(error)})`);
  }

  return { dir, problems };
}
