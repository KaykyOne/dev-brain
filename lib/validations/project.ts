import { z } from "zod";

import { normalizeRelativePath } from "@/lib/security/paths";
import { SLUG_PATTERN } from "@/lib/slug";

import { skillListSchema } from "./skill";

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(80, "Máximo de 80 caracteres"),
  slug: z
    .string()
    .trim()
    .min(2, "Mínimo de 2 caracteres")
    .max(60, "Máximo de 60 caracteres")
    .regex(SLUG_PATTERN, "Use letras minúsculas, números e hífens"),
  description: z.string().trim().max(500, "Máximo de 500 caracteres"),
  repositoryPath: z
    .string()
    .trim()
    .refine((value) => value === "" || normalizeRelativePath(value) !== null, "Caminho relativo inválido"),
  defaultBranch: z
    .string()
    .trim()
    .min(1, "Informe a branch")
    .max(100)
    .regex(/^[\w./-]+$/, "Nome de branch inválido")
    .refine((value) => !value.includes(".."), "Nome de branch inválido"),
});

export type ProjectInput = z.infer<typeof projectSchema>;

/** Cadastro: os dados do projeto mais as skills específicas criadas junto com ele. */
export const createProjectSchema = projectSchema.extend({ skills: skillListSchema });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
