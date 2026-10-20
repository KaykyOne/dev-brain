import "server-only";

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { projects, projectSkillLinks, skills, type Skill } from "@/db/schema";

export function listUniversalSkills(ownerId: string) {
  return db
    .select()
    .from(skills)
    .where(and(eq(skills.ownerId, ownerId), eq(skills.scope, "universal")))
    .orderBy(asc(skills.name));
}

export function listProjectSkills(projectId: string) {
  return db.select().from(skills).where(eq(skills.projectId, projectId)).orderBy(asc(skills.name));
}

/** Skills específicas de todos os projetos do dono, já com os dados do projeto. */
export async function listAllProjectSkills(ownerId: string) {
  const rows = await db
    .select({ skill: skills, project: projects })
    .from(skills)
    .innerJoin(projects, eq(projects.id, skills.projectId))
    .where(eq(skills.ownerId, ownerId))
    .orderBy(asc(projects.name), asc(skills.name));

  return rows;
}

export type LibrarySkill = Skill & { projectIds: string[] };

/** Skills da biblioteca com os ids dos projetos em que cada uma está aplicada. */
export async function listLibrarySkills(ownerId: string): Promise<LibrarySkill[]> {
  const library = await db
    .select()
    .from(skills)
    .where(and(eq(skills.ownerId, ownerId), eq(skills.scope, "library")))
    .orderBy(asc(skills.name));
  if (library.length === 0) return [];

  const links = await db
    .select({ skillId: projectSkillLinks.skillId, projectId: projectSkillLinks.projectId })
    .from(projectSkillLinks)
    .where(
      inArray(
        projectSkillLinks.skillId,
        library.map((skill) => skill.id),
      ),
    );

  const byskill = new Map<string, string[]>();
  for (const link of links) byskill.set(link.skillId, [...(byskill.get(link.skillId) ?? []), link.projectId]);

  return library.map((skill) => ({ ...skill, projectIds: byskill.get(skill.id) ?? [] }));
}

/** Skills da biblioteca aplicadas a um projeto. */
export function listLinkedLibrarySkills(projectId: string) {
  return db
    .select({ skill: skills })
    .from(projectSkillLinks)
    .innerJoin(skills, eq(skills.id, projectSkillLinks.skillId))
    .where(eq(projectSkillLinks.projectId, projectId))
    .orderBy(asc(skills.name))
    .then((rows) => rows.map((row) => row.skill));
}

/** Prioridade quando o mesmo slug existe em mais de um escopo: a mais específica vence. */
const PRECEDENCE: Record<Skill["scope"], number> = { project: 0, library: 1, universal: 2 };

/** Skill pelo slug, valendo para o projeto: projeto > biblioteca aplicada ao projeto > universal. */
export async function findSkillForProject(project: { id: string; ownerId: string }, slug: string) {
  const rows = await db
    .select()
    .from(skills)
    .where(
      and(
        eq(skills.ownerId, project.ownerId),
        eq(skills.slug, slug),
        or(
          eq(skills.scope, "universal"),
          eq(skills.projectId, project.id),
          and(
            eq(skills.scope, "library"),
            sql`${skills.id} in (select ${projectSkillLinks.skillId} from ${projectSkillLinks} where ${projectSkillLinks.projectId} = ${project.id})`,
          ),
        ),
      ),
    );

  return rows.sort((a, b) => PRECEDENCE[a.scope] - PRECEDENCE[b.scope])[0] ?? null;
}
