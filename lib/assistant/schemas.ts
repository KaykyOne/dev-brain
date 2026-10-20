import { z } from "zod";

/**
 * Validação dos argumentos de cada ação (a fonte de verdade em tempo de execução). Os parâmetros enviados ao modelo
 * ficam em actions.json; um teste garante que os dois descrevem as mesmas ações.
 */

const text = z.string().trim().min(1).max(200);
const slug = z.string().trim().min(1).max(100);
const scope = z.enum(["universal", "library", "project"]);
const skillRef = { slug, scope, project: slug.optional() };
const description = z.string().trim().min(1).max(500);
const skillContent = z.string().max(100_000);

export const listProjectsArgs = z.object({}).strict();
export const getProjectArgs = z.object({ slug }).strict();
export const listSkillsArgs = z
  .object({ scope: scope.optional(), project: slug.optional(), query: z.string().trim().max(200).optional() })
  .strict();
export const getSkillArgs = z.object(skillRef).strict();
export const listContextFilesArgs = z.object({ project: slug }).strict();
export const readContextFileArgs = z.object({ project: slug, path: z.string().trim().min(1).max(300) }).strict();
export const createSkillArgs = z
  .object({ name: text, description, content: skillContent.optional(), scope, project: slug.optional() })
  .strict();
export const updateSkillArgs = z
  .object({ ...skillRef, name: text.optional(), description: description.optional(), content: skillContent.optional() })
  .strict();
export const applyLibrarySkillArgs = z
  .object({ slug, projects: z.array(slug).max(100), mode: z.enum(["add", "remove", "set"]) })
  .strict();
export const promoteSkillArgs = z
  .object({
    slug,
    project: slug,
    target: z.enum(["universal", "library"]),
    name: text.optional(),
    description: description.optional(),
    content: skillContent.optional(),
    projects: z.array(slug).max(100).optional(),
    keep_original: z.boolean().optional(),
  })
  .strict();
export const createProjectArgs = z
  .object({ name: text, slug: slug.optional(), description: z.string().trim().max(500).optional(), library_skills: z.array(slug).max(100).optional() })
  .strict();
export const updateProjectArgs = z
  .object({ slug, name: text.optional(), description: z.string().trim().max(500).optional(), default_branch: z.string().trim().min(1).max(100).optional() })
  .strict();
export const writeContextFileArgs = z
  .object({ project: slug, path: z.string().trim().min(1).max(300), content: z.string().max(400_000), message: z.string().trim().min(1).max(200) })
  .strict();
export const deleteSkillArgs = z.object(skillRef).strict();
export const deleteProjectArgs = z.object({ slug }).strict();

export const ARG_SCHEMAS = {
  list_projects: listProjectsArgs,
  get_project: getProjectArgs,
  list_skills: listSkillsArgs,
  get_skill: getSkillArgs,
  list_context_files: listContextFilesArgs,
  read_context_file: readContextFileArgs,
  create_skill: createSkillArgs,
  update_skill: updateSkillArgs,
  apply_library_skill: applyLibrarySkillArgs,
  promote_skill: promoteSkillArgs,
  create_project: createProjectArgs,
  update_project: updateProjectArgs,
  write_context_file: writeContextFileArgs,
  delete_skill: deleteSkillArgs,
  delete_project: deleteProjectArgs,
} satisfies Record<string, z.ZodType>;
