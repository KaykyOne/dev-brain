"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { projects, skills } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { fail, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/dal";
import { isUniqueViolation } from "@/lib/db-errors";
import { normalizeRelativePath } from "@/lib/security/paths";
import { findSecrets } from "@/lib/security/secrets";
import { slugify } from "@/lib/slug";
import { createProjectSchema, projectSchema } from "@/lib/validations/project";

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

  const { skills: projectSkills, repositoryPath, ...values } = parsed.data;

  for (const skill of projectSkills) {
    const secrets = findSecrets(skill.content);
    if (secrets.length > 0) {
      return fail("Dados inválidos", { skills: [`“${skill.name}” parece conter segredos (${secrets.join(", ")})`] });
    }
  }

  try {
    // Projeto e skills são criados juntos: ou tudo entra, ou nada.
    const project = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(projects)
        .values({ ...values, repositoryPath: normalizeRelativePath(repositoryPath), ownerId: user.id })
        .returning({ id: projects.id, slug: projects.slug });

      if (projectSkills.length > 0) {
        await tx.insert(skills).values(
          projectSkills.map((skill) => ({
            name: skill.name,
            description: skill.description,
            content: skill.content.trim() ? skill.content : null,
            slug: slugify(skill.name),
            projectId: created.id,
            ownerId: user.id,
          })),
        );
      }

      return created;
    });

    await logActivity({
      action: "project.created",
      actorId: user.id,
      projectId: project.id,
      metadata: { name: values.name, skills: projectSkills.length },
    });

    return { ok: true, data: { slug: project.slug } };
  } catch (error) {
    if (isUniqueViolation(error)) return SLUG_TAKEN;
    throw error;
  }
}

export async function updateProject(id: string, input: unknown): Promise<ActionResult<{ slug: string }>> {
  const user = await getCurrentUser();
  const parsed = parseProject(input);
  if (!parsed.success) return parsed.result;

  try {
    const [project] = await db
      .update(projects)
      .set(parsed.values)
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
    .returning({ name: projects.name });

  if (!project) return fail("Projeto não encontrado");

  await logActivity({ action: "project.deleted", actorId: user.id, metadata: { name: project.name } });

  return { ok: true, data: undefined };
}
