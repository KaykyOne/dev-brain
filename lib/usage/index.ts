import "server-only";

import { and, eq, gte, inArray, lt } from "drizzle-orm";

import { db } from "@/db";
import { mcpUsage, projects, type Project } from "@/db/schema";
import { logger } from "@/lib/logger";
import { getRepoTextChars } from "@/lib/projects/repo-info";
import { listLinkedLibrarySkills, listProjectSkills, listUniversalSkills } from "@/lib/skills/queries";

import { summarizeUsage, type UsageTotals } from "./estimate";

export { CHARS_PER_TOKEN, SESSION_GAP_MS, type UsageTotals } from "./estimate";

const USAGE_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Registra o tamanho de uma resposta do MCP. Nunca derruba a ferramenta: falhas só vão para o log. */
export async function recordMcpUsage(entry: {
  ownerId: string;
  projectId: string | null;
  tokenId: string;
  tool: string;
  responseChars: number;
}) {
  try {
    await db.insert(mcpUsage).values(entry);
  } catch (error) {
    await logger.warn("mcp", "Não foi possível registrar o uso do MCP", { error });
  }
}

/**
 * Caracteres do contexto inteiro de um projeto: o repositório de contexto mais as skills que valem para ele
 * (com o mesmo slug em mais de um escopo, conta só a mais específica, como o MCP entrega).
 */
export async function getFullContextChars(project: Pick<Project, "id" | "ownerId" | "name" | "slug" | "description" | "defaultBranch">) {
  const [repoChars, universal, library, specific] = await Promise.all([
    getRepoTextChars(project),
    listUniversalSkills(project.ownerId),
    listLinkedLibrarySkills(project.id),
    listProjectSkills(project.id),
  ]);
  if (repoChars === null) return null;

  const bySlug = new Map<string, number>();
  for (const skill of [...universal, ...library, ...specific]) bySlug.set(skill.slug, skill.content?.length ?? 0);

  return repoChars + [...bySlug.values()].reduce((total, chars) => total + chars, 0);
}

export type UsageSummary = {
  days: number;
  overall: UsageTotals;
  byProject: Map<string, UsageTotals>;
};

/** Uso do MCP nos últimos `days` dias, da conta inteira ou de um projeto. */
export async function getUsageSummary(ownerId: string, options: { days: number; projectId?: string }): Promise<UsageSummary> {
  const since = new Date(Date.now() - options.days * DAY_MS);

  const calls = await db
    .select({
      projectId: mcpUsage.projectId,
      tokenId: mcpUsage.tokenId,
      responseChars: mcpUsage.responseChars,
      createdAt: mcpUsage.createdAt,
    })
    .from(mcpUsage)
    .where(
      and(
        eq(mcpUsage.ownerId, ownerId),
        gte(mcpUsage.createdAt, since),
        options.projectId ? eq(mcpUsage.projectId, options.projectId) : undefined,
      ),
    );

  // O contexto inteiro só é medido para os projetos que tiveram uso no período.
  const projectIds = [...new Set(calls.map((call) => call.projectId).filter((id): id is string => id !== null))];
  const used = projectIds.length
    ? await db.select().from(projects).where(and(eq(projects.ownerId, ownerId), inArray(projects.id, projectIds)))
    : [];

  const sizes = await Promise.all(used.map(async (project) => [project.id, await getFullContextChars(project)] as const));
  const fullContextChars = new Map(sizes.filter((entry): entry is readonly [string, number] => entry[1] !== null));

  return { days: options.days, ...summarizeUsage(calls, fullContextChars) };
}

/** Apaga registros de uso antigos (rodado na subida, como os logs). */
export async function pruneUsage(days = USAGE_RETENTION_DAYS) {
  await db.delete(mcpUsage).where(lt(mcpUsage.createdAt, new Date(Date.now() - days * DAY_MS)));
}
