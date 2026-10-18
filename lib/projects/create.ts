import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { projects, skills } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { fail, type ActionResult } from "@/lib/action-result";
import { contextRepos } from "@/lib/context-repo";
import { isUniqueViolation } from "@/lib/db-errors";
import { normalizeSkillContent } from "@/lib/skills/content";
import { slugify } from "@/lib/slug";

type NewProject = {
  name: string;
  slug: string;
  description: string;
  defaultBranch: string;
};

type NewSkill = { name: string; description: string; content: string };

/**
 * Cria o projeto e o repositório git de contexto (no padrão de `templates/context`).
 * Se o repositório não puder ser criado, o projeto é desfeito: nunca fica projeto sem repositório.
 */
export async function createProjectWithRepo(input: {
  ownerId: string;
  values: NewProject;
  skills?: NewSkill[];
}): Promise<ActionResult<{ id: string; slug: string }>> {
  const { ownerId, values, skills: projectSkills = [] } = input;

  let project: { id: string; slug: string };
  try {
    // Projeto e skills são criados juntos: ou tudo entra, ou nada.
    project = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(projects)
        .values({ ...values, ownerId })
        .returning({ id: projects.id, slug: projects.slug });

      if (projectSkills.length > 0) {
        await tx.insert(skills).values(
          projectSkills.map((skill) => ({
            name: skill.name,
            description: skill.description,
            content: normalizeSkillContent(skill.content),
            slug: slugify(skill.name),
            projectId: created.id,
            ownerId,
          })),
        );
      }

      return created;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fail("Dados inválidos", { slug: ["Este slug já está em uso"] });
    throw error;
  }

  try {
    await contextRepos.init(
      { name: values.name, slug: values.slug, description: values.description },
      values.defaultBranch,
    );
  } catch (error) {
    await db.delete(projects).where(eq(projects.id, project.id));
    console.error("Falha ao criar o repositório de contexto", error);
    return fail("Não foi possível criar o repositório git do projeto");
  }

  await logActivity({
    action: "project.created",
    actorId: ownerId,
    projectId: project.id,
    metadata: { name: values.name, skills: projectSkills.length },
  });

  return { ok: true, data: project };
}
