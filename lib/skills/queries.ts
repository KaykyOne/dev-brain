import "server-only";

import { and, asc, eq, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { projects, skills } from "@/db/schema";

export function listUniversalSkills(ownerId: string) {
  return db
    .select()
    .from(skills)
    .where(and(eq(skills.ownerId, ownerId), isNull(skills.projectId)))
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

/** Skill pelo slug, valendo para o projeto: a do projeto tem prioridade sobre a universal. */
export async function findSkillForProject(project: { id: string; ownerId: string }, slug: string) {
  const rows = await db
    .select()
    .from(skills)
    .where(
      and(
        eq(skills.ownerId, project.ownerId),
        eq(skills.slug, slug),
        or(isNull(skills.projectId), eq(skills.projectId, project.id)),
      ),
    );

  return rows.find((row) => row.projectId) ?? rows[0] ?? null;
}
