"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { projects } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { fail, type ActionResult } from "@/lib/action-result";
import { contextRepos } from "@/lib/context-repo";
import { getCurrentUser } from "@/lib/auth/dal";
import { isUniqueViolation } from "@/lib/db-errors";
import { logger } from "@/lib/logger";
import { normalizeRelativePath } from "@/lib/security/paths";
import { checkSkillContent } from "@/lib/skills/content";
import { createProjectSchema, projectSchema } from "@/lib/validations/project";

import { createProjectWithRepo } from "./create";

const SLUG_TAKEN = fail("Dados inválidos", { slug: ["Este slug já está em uso"] });

function parseProject(input: unknown) {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, result: fail("Dados inválidos", z.flattenError(parsed.error).fieldErrors) } as const;
  }

  const { repositoryPath, ...rest } = parsed.data;
  return { success: true, values: { ...rest, repositoryPath: normalizeRelativePath(repositoryPath) } } as const;
}

export async function createProject(input: unknown): Promise<ActionResult<{ slug: string }>> {
  const user = await getCurrentUser();

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos", z.flattenError(parsed.error).fieldErrors);

  const { skills: projectSkills, librarySkillIds, name, slug, description, defaultBranch } = parsed.data;
  const values = { name, slug, description, defaultBranch };

  for (const skill of projectSkills) {
    const checked = checkSkillContent(skill.content);
    if (!checked.ok) return fail("Dados inválidos", { skills: [`“${skill.name}” ${checked.message}`] });
  }

  return createProjectWithRepo({ ownerId: user.id, values, skills: projectSkills, librarySkillIds });
}

export async function updateProject(id: string, input: unknown): Promise<ActionResult<{ slug: string }>> {
  const user = await getCurrentUser();
  const parsed = parseProject(input);
  if (!parsed.success) return parsed.result;

  try {
    const [project] = await db
      .update(projects)
      // O slug nomeia o repositório git do projeto: não muda depois de criado.
      .set({ ...parsed.values, slug: undefined })
      .where(and(eq(projects.id, id), eq(projects.ownerId, user.id)))
      .returning({ id: projects.id, slug: projects.slug });

    if (!project) return fail("Projeto não encontrado");

    await logActivity({
      action: "project.updated",
      actorId: user.id,
      projectId: project.id,
      metadata: { name: parsed.values.name },
    });

    return { ok: true, data: { slug: project.slug } };
  } catch (error) {
    if (isUniqueViolation(error)) return SLUG_TAKEN;
    throw error;
  }
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();

  const [project] = await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, user.id)))
    .returning({ name: projects.name, slug: projects.slug });

  if (!project) return fail("Projeto não encontrado");

  // O histórico git é preservado em .trash/ do volume de repositórios.
  await contextRepos
    .archive(project.slug)
    .catch((error) => logger.error("projects", `Falha ao arquivar o repositório de "${project.slug}"`, { error }));

  await logActivity({ action: "project.deleted", actorId: user.id, metadata: { name: project.name } });

  return { ok: true, data: undefined };
}

export async function setProjectActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();

  const [project] = await db
    .update(projects)
    .set({ active })
    .where(and(eq(projects.id, id), eq(projects.ownerId, user.id)))
    .returning({ id: projects.id, name: projects.name });

  if (!project) return fail("Projeto não encontrado");

  await logActivity({
    action: active ? "project.activated" : "project.deactivated",
    actorId: user.id,
    projectId: project.id,
    metadata: { name: project.name },
  });

  return { ok: true, data: undefined };
}
