import { z } from "zod";

import { slugify } from "@/lib/slug";

export const MAX_SKILL_CONTENT = 100_000;

export const skillSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(80, "Máximo de 80 caracteres"),
  description: z
    .string()
    .trim()
    .min(1, "Descreva quando a skill deve ser usada")
    .max(500, "Máximo de 500 caracteres"),
  // SKILL.md importado; vazio quando a skill foi criada só com nome e descrição.
  content: z.string().max(MAX_SKILL_CONTENT, "Arquivo muito grande (máximo de 100 KB)"),
});

export type SkillInput = z.infer<typeof skillSchema>;

/** Lista de skills enviada junto com o projeto: sem nomes que gerem o mesmo slug. */
export const skillListSchema = z
  .array(skillSchema)
  .max(20, "Máximo de 20 skills no cadastro")
  .superRefine((skills, ctx) => {
    const seen = new Set<string>();
    for (const skill of skills) {
      const slug = slugify(skill.name);
      if (!slug) {
        ctx.addIssue({ code: "custom", message: `“${skill.name}” não gera um identificador válido` });
      } else if (seen.has(slug)) {
        ctx.addIssue({ code: "custom", message: `Skill duplicada: “${skill.name}”` });
      }
      seen.add(slug);
    }
  });

export const SKILL_TARGET_UNIVERSAL = "universal";
export const SKILL_TARGET_LIBRARY = "library";

/** Onde uma skill nasce: universal, biblioteca ou o id de um projeto. */
export const skillTargetSchema = z.union([z.literal(SKILL_TARGET_UNIVERSAL), z.literal(SKILL_TARGET_LIBRARY), z.uuid()]);

export const projectIdsSchema = z.array(z.uuid()).max(200);

/**
 * Promoção de uma skill de projeto: os campos (já editados), para onde vai (universal ou biblioteca), em quais
 * projetos aplicar (biblioteca) e se o original permanece no projeto.
 */
export const promoteSkillSchema = skillSchema.extend({
  keepOriginal: z.boolean(),
  target: z.enum([SKILL_TARGET_UNIVERSAL, SKILL_TARGET_LIBRARY]),
  projectIds: projectIdsSchema,
});

export type PromoteSkillInput = z.infer<typeof promoteSkillSchema>;
