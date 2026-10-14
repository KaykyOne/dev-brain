"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { projects, skills } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { fail, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/dal";
import { isUniqueViolation } from "@/lib/db-errors";
import { findSecrets } from "@/lib/security/secrets";
import { slugify } from "@/lib/slug";
import { skillSchema } from "@/lib/validations/skill";

const MAX_BULK_IMPORT = 50;

/** Conteúdo vazio vira null; conteúdo com segredos é recusado. */
function prepareContent(content: string) {
  const secrets = findSecrets(content);
  if (secrets.length > 0) {
    return {
      success: false,
      result: fail("Dados inválidos", { content: [`O arquivo parece conter segredos (${secrets.join(", ")})`] }),
    } as const;
  }
  return { success: true, content: content.trim() ? content : null } as const;
}

const DUPLICATE = fail("Dados inválidos", { name: ["Já existe uma skill com esse nome neste escopo"] });

export async function createSkill(projectId: string | null, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();

  const parsed = skillSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos", z.flattenError(parsed.error).fieldErrors);

  const prepared = prepareContent(parsed.data.content);
  if (!prepared.success) return prepared.result;

  const slug = slugify(parsed.data.name);
  if (!slug) return fail("Dados inválidos", { name: ["Use letras ou números no nome"] });

  if (projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, user.id)))
      .limit(1);
    if (!project) return fail("Projeto não encontrado");
  }

  try {
    await db.insert(skills).values({ ...parsed.data, content: prepared.content, slug, projectId, ownerId: user.id });
  } catch (error) {
    if (isUniqueViolation(error)) return DUPLICATE;
    throw error;
  }

  await logActivity({
    action: "skill.created",
    actorId: user.id,
    projectId,
    metadata: { name: parsed.data.name, universal: projectId === null },
  });

  return { ok: true, data: undefined };
}

/** O slug (e portanto o caminho no repositório) permanece estável; nome, descrição e conteúdo mudam. */
export async function updateSkill(id: string, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();

  const parsed = skillSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos", z.flattenError(parsed.error).fieldErrors);

  const prepared = prepareContent(parsed.data.content);
  if (!prepared.success) return prepared.result;

  const [skill] = await db
    .update(skills)
    .set({ ...parsed.data, content: prepared.content })
    .where(and(eq(skills.id, id), eq(skills.ownerId, user.id)))
    .returning({ projectId: skills.projectId });

  if (!skill) return fail("Skill não encontrada");

  await logActivity({
    action: "skill.updated",
    actorId: user.id,
    projectId: skill.projectId,
    metadata: { name: parsed.data.name },
  });

  return { ok: true, data: undefined };
}

export async function deleteSkill(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();

  const [skill] = await db
    .delete(skills)
    .where(and(eq(skills.id, id), eq(skills.ownerId, user.id)))
    .returning({ name: skills.name, projectId: skills.projectId });

  if (!skill) return fail("Skill não encontrada");

  await logActivity({
    action: "skill.deleted",
    actorId: user.id,
    projectId: skill.projectId,
    metadata: { name: skill.name },
  });

  return { ok: true, data: undefined };
}

export type ImportSkillsResult = { created: number; failed: { name: string; reason: string }[] };

/**
 * Importa várias skills de uma vez (1 arquivo = 1 skill). Cada item é tratado isoladamente:
 * um duplicado ou inválido não impede os demais, e o resultado informa o que falhou.
 */
export async function importSkills(projectId: string | null, input: unknown): Promise<ActionResult<ImportSkillsResult>> {
  const user = await getCurrentUser();

  const list = z.array(z.unknown()).min(1).max(MAX_BULK_IMPORT).safeParse(input);
  if (!list.success) return fail(`Envie de 1 a ${MAX_BULK_IMPORT} skills`);

  if (projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, user.id)))
      .limit(1);
    if (!project) return fail("Projeto não encontrado");
  }

  const result: ImportSkillsResult = { created: 0, failed: [] };

  for (const item of list.data) {
    const label = (item as { name?: unknown } | null)?.name;
    const name = typeof label === "string" && label.trim() ? label.trim() : "(sem nome)";

    const parsed = skillSchema.safeParse(item);
    if (!parsed.success) {
      result.failed.push({ name, reason: z.prettifyError(parsed.error).replace(/\n/g, "; ") });
      continue;
    }

    const prepared = prepareContent(parsed.data.content);
    if (!prepared.success) {
      result.failed.push({ name, reason: "o arquivo parece conter segredos" });
      continue;
    }

    const slug = slugify(parsed.data.name);
    if (!slug) {
      result.failed.push({ name, reason: "o nome não gera um identificador válido" });
      continue;
    }

    try {
      await db.insert(skills).values({ ...parsed.data, content: prepared.content, slug, projectId, ownerId: user.id });
      result.created += 1;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      result.failed.push({ name, reason: "já existe uma skill com esse nome neste escopo" });
    }
  }

  if (result.created > 0) {
    await logActivity({
      action: "skill.created",
      actorId: user.id,
      projectId,
      metadata: { name: `${result.created} skills importadas`, universal: projectId === null },
    });
  }

  return { ok: true, data: result };
}
