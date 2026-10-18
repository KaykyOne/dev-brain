import { ensureAdminUser } from "@/lib/auth/bootstrap";
import { checkContextRepos } from "@/lib/context-repo/health";
import { basePath, env } from "@/lib/env";
import { logger, pruneLogs } from "@/lib/logger";

/** Tarefas executadas uma vez quando o servidor sobe. Falhas são registradas, nunca derrubam o servidor. */
export async function startup() {
  const { dir, problems } = await checkContextRepos(env.CONTEXT_REPOS_DIR);

  if (problems.length > 0) {
    await logger.error("startup", "Repositórios de contexto indisponíveis", {
      details: { problems, CONTEXT_REPOS_DIR: env.CONTEXT_REPOS_DIR, resolvido: dir },
    });
  }

  try {
    if (await ensureAdminUser()) await logger.info("startup", `Usuário inicial criado: ${env.ADMIN_EMAIL}`);
  } catch (error) {
    await logger.error("startup", "Não foi possível garantir o usuário inicial", { error });
  }

  await pruneLogs().catch((error) => logger.warn("startup", "Falha ao limpar logs antigos", { error }));

  await logger.info("startup", "Servidor iniciado", {
    details: { nodeEnv: env.NODE_ENV, appUrl: env.APP_URL, basePath, contextReposDir: dir, repositoriosOk: problems.length === 0 },
  });
}
