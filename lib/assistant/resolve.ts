import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { projects, projectSkillLinks, skills, type Project, type Skill } from "@/db/schema";

export type SkillRef = { slug: string; scope: Skill["scope"]; project?: string };

/** Projeto do usuário pelo slug, ou null (sem lançar 404 como `getProjectBySlug`). */
export async function findProject(userId: string, slug: string): Promise<Project | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerId, userId), eq(projects.slug, slug)))
    .limit(1);
  return project ?? null;
}

/** Projetos pelos slugs: devolve os encontrados e quais slugs não existem. */
export async function findProjects(userId: string, slugs: string[]) {
  const unique = [...new Set(slugs)];
  const found = unique.length
    ? await db
        .select()
        .from(projects)
        .where(and(eq(projects.ownerId, userId), inArray(projects.slug, unique)))
    : [];

  const known = new Set(found.map((project) => project.slug));
  return { projects: found, missing: unique.filter((slug) => !known.has(slug)) };
}

export type FoundSkill = { skill: Skill; project: Project | null } | { error: string };

/** Skill por referência (slug + escopo + projeto). Erro legível quando não existe ou a referência está incompleta. */
export async function findSkill(userId: string, ref: SkillRef): Promise<FoundSkill> {
  if (ref.scope === "project") {
    if (!ref.project) return { error: 'Informe "project" (slug do projeto) para skills de escopo project.' };

    const project = await findProject(userId, ref.project);
    if (!project) return { error: `Projeto "${ref.project}" não encontrado.` };

    const [skill] = await db
      .select()
      .from(skills)
      .where(and(eq(skills.ownerId, userId), eq(skills.projectId, project.id), eq(skills.slug, ref.slug)))
      .limit(1);
    return skill ? { skill, project } : { error: `Skill "${ref.slug}" não encontrada no projeto "${ref.project}".` };
  }

  const [skill] = await db
    .select()
    .from(skills)
    .where(and(eq(skills.ownerId, userId), eq(skills.scope, ref.scope), eq(skills.slug, ref.slug)))
    .limit(1);
  return skill ? { skill, project: null } : { error: `Skill "${ref.slug}" não encontrada no escopo ${ref.scope}.` };
}

/** Slugs dos projetos em que uma skill da biblioteca está aplicada. */
export async function appliedProjectSlugs(skillId: string): Promise<{ ids: string[]; slugs: string[] }> {
  const rows = await db
    .select({ id: projects.id, slug: projects.slug })
    .from(projectSkillLinks)
    .innerJoin(projects, eq(projects.id, projectSkillLinks.projectId))
    .where(eq(projectSkillLinks.skillId, skillId));
  return { ids: rows.map((row) => row.id), slugs: rows.map((row) => row.slug).sort() };
}
