"use server";

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { projects, projectSkillLinks, skills, type SkillScope } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { fail, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/dal";
import { isUniqueViolation } from "@/lib/db-errors";
import { slugify } from "@/lib/slug";
import { checkSkillContent } from "./content";
import {
  projectIdsSchema,
  promoteSkillSchema,
  SKILL_TARGET_LIBRARY,
  SKILL_TARGET_UNIVERSAL,
  skillSchema,
  skillTargetSchema,
} from "@/lib/validations/skill";

const MAX_BULK_IMPORT = 50;

/** Adapta o resultado da checagem do conteúdo ao formato de erro de campo das actions. */
function prepareContent(content: string) {
  const checked = checkSkillContent(content);
  if (checked.ok) return { success: true, content: checked.content } as const;

  return {
    success: false,
    result: fail("Dados inválidos", { content: [`O arquivo ${checked.message}`] }),
  } as const;
}

const DUPLICATE = fail("Dados inválidos", { name: ["Já existe uma skill com esse nome neste escopo"] });

type Placement = { scope: SkillScope; projectId: string | null };

/** Traduz o destino ("universal", "library" ou id de projeto) em escopo e projeto; null se o projeto não for do usuário. */
async function resolvePlacement(userId: string, target: unknown): Promise<Placement | null> {
  const parsed = skillTargetSchema.safeParse(target);
  if (!parsed.success) return null;
  if (parsed.data === SKILL_TARGET_UNIVERSAL) return { scope: "universal", projectId: null };
  if (parsed.data === SKILL_TARGET_LIBRARY) return { scope: "library", projectId: null };

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, parsed.data), eq(projects.ownerId, userId)))
    .limit(1);
  return project ? { scope: "project", projectId: project.id } : null;
}

/** Ids únicos dos projetos que pertencem ao usuário; null se algum não for dele. */
async function ownedProjectIds(userId: string, ids: string[]): Promise<string[] | null> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];

  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(inArray(projects.id, unique), eq(projects.ownerId, userId)));
  return rows.length === unique.length ? unique : null;
}

/** Cria uma skill no destino: "universal", "library" ou o id de um projeto. */
export async function createSkill(target: string, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();

  const parsed = skillSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos", z.flattenError(parsed.error).fieldErrors);

  const prepared = prepareContent(parsed.data.content);
  if (!prepared.success) return prepared.result;

  const slug = slugify(parsed.data.name);
  if (!slug) return fail("Dados inválidos", { name: ["Use letras ou números no nome"] });

  const placement = await resolvePlacement(user.id, target);
  if (!placement) return fail("Projeto não encontrado");

  try {
    await db.insert(skills).values({ ...parsed.data, content: prepared.content, slug, ...placement, ownerId: user.id });
  } catch (error) {
    if (isUniqueViolation(error)) return DUPLICATE;
    throw error;
  }

  await logActivity({
    action: "skill.created",
    actorId: user.id,
    projectId: placement.projectId,
    metadata: { name: parsed.data.name, scope: placement.scope },
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
export async function importSkills(target: string, input: unknown): Promise<ActionResult<ImportSkillsResult>> {
  const user = await getCurrentUser();

  const list = z.array(z.unknown()).min(1).max(MAX_BULK_IMPORT).safeParse(input);
  if (!list.success) return fail(`Envie de 1 a ${MAX_BULK_IMPORT} skills`);

  const placement = await resolvePlacement(user.id, target);
  if (!placement) return fail("Projeto não encontrado");

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
      await db.insert(skills).values({ ...parsed.data, content: prepared.content, slug, ...placement, ownerId: user.id });
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
      projectId: placement.projectId,
      metadata: { name: `${result.created} skills importadas`, scope: placement.scope },
    });
  }

  return { ok: true, data: result };
}

/**
 * Promove uma skill de projeto: cria a universal (vale para todos) ou a da biblioteca (aplicada aos projetos escolhidos)
 * com o conteúdo já editado pelo usuário e, a menos que `keepOriginal` seja verdadeiro, remove a original do projeto.
 * Ao mover para a biblioteca, o projeto de origem continua com a skill, agora por aplicação. Tudo em uma transação.
 */
export async function promoteSkill(id: string, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();

  const parsed = promoteSkillSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos", z.flattenError(parsed.error).fieldErrors);

  const { keepOriginal, target, projectIds, ...values } = parsed.data;

  const prepared = prepareContent(values.content);
  if (!prepared.success) return prepared.result;

  const slug = slugify(values.name);
  if (!slug) return fail("Dados inválidos", { name: ["Use letras ou números no nome"] });

  const [original] = await db
    .select({ id: skills.id, projectId: skills.projectId })
    .from(skills)
    .where(and(eq(skills.id, id), eq(skills.ownerId, user.id)))
    .limit(1);
  if (!original?.projectId) return fail("Só skills de projeto podem ser promovidas");

  const scope: SkillScope = target === SKILL_TARGET_LIBRARY ? "library" : "universal";

  // Biblioteca: aplica aos projetos escolhidos e, se a original sair do projeto, mantém o projeto de origem.
  const wanted = scope === "library" ? [...projectIds, ...(keepOriginal ? [] : [original.projectId])] : [];
  const linkIds = await ownedProjectIds(user.id, wanted);
  if (!linkIds) return fail("Projeto não encontrado");

  try {
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(skills)
        .values({ ...values, content: prepared.content, slug, scope, projectId: null, ownerId: user.id })
        .returning({ id: skills.id });

      if (linkIds.length > 0) {
        await tx.insert(projectSkillLinks).values(linkIds.map((projectId) => ({ projectId, skillId: created.id })));
      }
      if (!keepOriginal) await tx.delete(skills).where(eq(skills.id, original.id));
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("Dados inválidos", { name: ["Já existe uma skill universal ou da biblioteca com esse nome"] });
    }
    throw error;
  }

  await logActivity({
    action: "skill.promoted",
    actorId: user.id,
    projectId: original.projectId,
    metadata: { name: values.name, scope, keptOriginal: keepOriginal, projects: linkIds.length },
  });

  return { ok: true, data: undefined };
}

/** Define em quais projetos uma skill da biblioteca está aplicada (o conjunto enviado substitui o anterior). */
export async function setSkillProjects(skillId: string, projectIds: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();

  const parsed = projectIdsSchema.safeParse(projectIds);
  if (!parsed.success) return fail("Seleção inválida");

  const [skill] = await db
    .select({ name: skills.name })
    .from(skills)
    .where(and(eq(skills.id, skillId), eq(skills.ownerId, user.id), eq(skills.scope, "library")))
    .limit(1);
  if (!skill) return fail("Skill da biblioteca não encontrada");

  const ids = await ownedProjectIds(user.id, parsed.data);
  if (!ids) return fail("Projeto não encontrado");

  await db.transaction(async (tx) => {
    await tx
      .delete(projectSkillLinks)
      .where(and(eq(projectSkillLinks.skillId, skillId), ids.length > 0 ? notInArray(projectSkillLinks.projectId, ids) : undefined));
    if (ids.length > 0) {
      await tx
        .insert(projectSkillLinks)
        .values(ids.map((projectId) => ({ projectId, skillId })))
        .onConflictDoNothing();
    }
  });

  await logActivity({ action: "skill.linked", actorId: user.id, metadata: { name: skill.name, projects: ids.length } });

  return { ok: true, data: undefined };
}

/** Aplica skills da biblioteca a um projeto (soma às que já estão aplicadas). */
export async function linkLibrarySkills(projectId: string, skillIds: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();

  const parsed = z.array(z.uuid()).min(1).max(200).safeParse(skillIds);
  if (!parsed.success) return fail("Selecione ao menos uma skill");

  const ids = [...new Set(parsed.data)];
  const [project] = await ownedProjectIds(user.id, [projectId]) ?? [];
  if (!project) return fail("Projeto não encontrado");

  const library = await db
    .select({ id: skills.id })
    .from(skills)
    .where(and(inArray(skills.id, ids), eq(skills.ownerId, user.id), eq(skills.scope, "library")));
  if (library.length !== ids.length) return fail("Skill da biblioteca não encontrada");

  await db
    .insert(projectSkillLinks)
    .values(ids.map((skillId) => ({ projectId: project, skillId })))
    .onConflictDoNothing();

  await logActivity({
    action: "skill.linked",
    actorId: user.id,
    projectId: project,
    metadata: { name: `${ids.length} ${ids.length === 1 ? "skill" : "skills"}`, projects: 1 },
  });

  return { ok: true, data: undefined };
}

/** Remove uma skill da biblioteca de um projeto. A skill continua na biblioteca. */
export async function unlinkLibrarySkill(projectId: string, skillId: string): Promise<ActionResult> {
  const user = await getCurrentUser();

  const [project] = (await ownedProjectIds(user.id, [projectId])) ?? [];
  if (!project) return fail("Projeto não encontrado");

  const [skill] = await db
    .select({ name: skills.name })
    .from(skills)
    .where(and(eq(skills.id, skillId), eq(skills.ownerId, user.id), eq(skills.scope, "library")))
    .limit(1);
  if (!skill) return fail("Skill da biblioteca não encontrada");

  await db
    .delete(projectSkillLinks)
    .where(and(eq(projectSkillLinks.projectId, project), eq(projectSkillLinks.skillId, skillId)));

  await logActivity({ action: "skill.unlinked", actorId: user.id, projectId: project, metadata: { name: skill.name } });

  return { ok: true, data: undefined };
}
