import "server-only";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { projects, projectSkillLinks, skills } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import type { ActionResult } from "@/lib/action-result";
import { contextRepos, RepoError } from "@/lib/context-repo";
import { createProject, deleteProject, updateProject } from "@/lib/projects/actions";
import { listProjects } from "@/lib/projects/queries";
import { getRepoInfo } from "@/lib/projects/repo-info";
import { findSecrets } from "@/lib/security/secrets";
import {
  createSkill,
  deleteSkill,
  promoteSkill,
  setSkillProjects,
  updateSkill,
} from "@/lib/skills/actions";
import { listLinkedLibrarySkills, listProjectSkills, listUniversalSkills } from "@/lib/skills/queries";
import { includesText } from "@/lib/skills/search";
import { slugify } from "@/lib/slug";

import { contentChange, textChange } from "./diff";
import type { Outcome } from "./outcome";
import type { Change, ResultLink } from "./protocol";
import { appliedProjectSlugs, findProject, findProjects, findSkill, type SkillRef } from "./resolve";
import {
  applyLibrarySkillArgs,
  createProjectArgs,
  createSkillArgs,
  deleteProjectArgs,
  deleteSkillArgs,
  getProjectArgs,
  getSkillArgs,
  listContextFilesArgs,
  listProjectsArgs,
  listSkillsArgs,
  promoteSkillArgs,
  readContextFileArgs,
  updateProjectArgs,
  updateSkillArgs,
  writeContextFileArgs,
} from "./schemas";

type Ctx = { userId: string };

export type Handler = {
  schema: z.ZodType;
  run: (args: never, ctx: Ctx) => Promise<Outcome>;
  /** Texto exibido ao pedir confirmação: o que exatamente será afetado. */
  preview?: (args: never, ctx: Ctx) => Promise<string>;
};

function handler<S extends z.ZodType>(definition: {
  schema: S;
  run: (args: z.infer<S>, ctx: Ctx) => Promise<Outcome>;
  preview?: (args: z.infer<S>, ctx: Ctx) => Promise<string>;
}): Handler {
  return definition as unknown as Handler;
}

const fail = (error: string): Outcome => ({ ok: false, error });

/** Junta a mensagem principal e os erros por campo de uma action em um texto que o modelo consiga usar. */
function describeFailure(result: Extract<ActionResult<unknown>, { ok: false }>): string {
  const fields = Object.entries(result.fieldErrors ?? {})
    .flatMap(([field, messages]) => (messages?.length ? [`${field}: ${messages.join(", ")}`] : []))
    .join("; ");
  return fields ? `${result.error} (${fields})` : result.error;
}

const scopeLabel = (value: string) => ({ universal: "universais", library: "biblioteca", project: "projeto" })[value] ?? value;
const skillLink = (label = "Abrir Skills"): ResultLink => ({ label, href: "/skills" });
const projectLink = (projectSlug: string): ResultLink => ({ label: "Abrir projeto", href: `/projects/${projectSlug}` });

/** Garante o repositório de contexto do projeto (cria se faltar) e falha com mensagem clara se o git não estiver acessível. */
async function ensureRepo(project: NonNullable<Awaited<ReturnType<typeof findProject>>>) {
  const info = await getRepoInfo(project);
  return info ?? null;
}

async function describeSkill(userId: string, ref: SkillRef) {
  const found = await findSkill(userId, ref);
  if ("error" in found) return found.error;
  const { skill, project } = found;
  return `${skill.name} (${scopeLabel(skill.scope)}${project ? ` · ${project.slug}` : ""})`;
}

export const HANDLERS: Record<string, Handler> = {
  list_projects: handler({
    schema: listProjectsArgs,
    async run(_args, { userId }) {
      const list = await listProjects(userId);
      return {
        ok: true,
        summary: `${list.length} ${list.length === 1 ? "projeto" : "projetos"}`,
        data: { projects: list.map(({ slug: id, name, description }) => ({ slug: id, name, description })) },
      };
    },
  }),

  get_project: handler({
    schema: getProjectArgs,
    async run({ slug: projectSlug }, { userId }) {
      const project = await findProject(userId, projectSlug);
      if (!project) return fail(`Projeto "${projectSlug}" não encontrado. Use list_projects para ver os slugs.`);

      const [repo, universal, own, linked] = await Promise.all([
        getRepoInfo(project),
        listUniversalSkills(userId),
        listProjectSkills(project.id),
        listLinkedLibrarySkills(project.id),
      ]);

      return {
        ok: true,
        summary: `Projeto ${project.name}`,
        links: [projectLink(project.slug)],
        data: {
          slug: project.slug,
          name: project.name,
          description: project.description,
          defaultBranch: project.defaultBranch,
          repo: repo ? { files: repo.files, commits: repo.commits, head: repo.head } : null,
          skills: { universal: universal.length, library: linked.length, project: own.length },
        },
      };
    },
  }),

  list_skills: handler({
    schema: listSkillsArgs,
    async run({ scope: onlyScope, project: projectSlug, query }, { userId }) {
      const rows = await db
        .select({ skill: skills, projectSlug: projects.slug })
        .from(skills)
        .leftJoin(projects, eq(projects.id, skills.projectId))
        .where(eq(skills.ownerId, userId))
        .orderBy(asc(skills.name));

      const links = await db
        .select({ skillId: projectSkillLinks.skillId, projectId: projectSkillLinks.projectId, projectSlug: projects.slug })
        .from(projectSkillLinks)
        .innerJoin(projects, eq(projects.id, projectSkillLinks.projectId));

      let visible = rows;
      if (projectSlug) {
        const project = await findProject(userId, projectSlug);
        if (!project) return fail(`Projeto "${projectSlug}" não encontrado.`);
        const linkedHere = new Set(links.filter((link) => link.projectId === project.id).map((link) => link.skillId));
        visible = rows.filter(
          ({ skill }) => skill.scope === "universal" || skill.projectId === project.id || (skill.scope === "library" && linkedHere.has(skill.id)),
        );
      }
      if (onlyScope) visible = visible.filter(({ skill }) => skill.scope === onlyScope);
      if (query) {
        visible = visible.filter(
          ({ skill }) => includesText(skill.name, query) || includesText(skill.description, query) || (skill.content ? includesText(skill.content, query) : false),
        );
      }

      const items = visible.map(({ skill, projectSlug: owner }) => ({
        slug: skill.slug,
        scope: skill.scope,
        ...(owner ? { project: owner } : {}),
        name: skill.name,
        description: skill.description,
        hasContent: !!skill.content,
        ...(skill.scope === "library"
          ? { appliedTo: links.filter((link) => link.skillId === skill.id).map((link) => link.projectSlug).sort() }
          : {}),
      }));

      return { ok: true, summary: `${items.length} ${items.length === 1 ? "skill" : "skills"}`, data: { skills: items } };
    },
  }),

  get_skill: handler({
    schema: getSkillArgs,
    async run(ref, { userId }) {
      const found = await findSkill(userId, ref);
      if ("error" in found) return fail(found.error);

      const { skill, project } = found;
      const applied = skill.scope === "library" ? (await appliedProjectSlugs(skill.id)).slugs : undefined;
      return {
        ok: true,
        summary: `Skill ${skill.name}`,
        data: {
          slug: skill.slug,
          scope: skill.scope,
          project: project?.slug,
          name: skill.name,
          description: skill.description,
          content: skill.content ?? "",
          appliedTo: applied,
        },
      };
    },
  }),

  list_context_files: handler({
    schema: listContextFilesArgs,
    async run({ project: projectSlug }, { userId }) {
      const project = await findProject(userId, projectSlug);
      if (!project) return fail(`Projeto "${projectSlug}" não encontrado.`);

      const repo = await ensureRepo(project);
      if (!repo) return fail("O repositório de contexto deste projeto está indisponível (veja a página Logs).");
      return { ok: true, summary: `${repo.files.length} arquivos em ${project.slug}`, data: { files: repo.files } };
    },
  }),

  read_context_file: handler({
    schema: readContextFileArgs,
    async run({ project: projectSlug, path }, { userId }) {
      const project = await findProject(userId, projectSlug);
      if (!project) return fail(`Projeto "${projectSlug}" não encontrado.`);
      if (!(await ensureRepo(project))) return fail("O repositório de contexto deste projeto está indisponível.");

      try {
        const file = await contextRepos.read(project.slug, path);
        return { ok: true, summary: `Leu ${file.path}`, data: file };
      } catch (error) {
        if (error instanceof RepoError) return fail(error.message);
        throw error;
      }
    },
  }),

  create_skill: handler({
    schema: createSkillArgs,
    async run({ name, description, content, scope: where, project: projectSlug }, { userId }) {
      // "universal" e "library" são destinos por si; "project" vira o id do projeto.
      let target: string = where;
      if (where === "project") {
        if (!projectSlug) return fail('Informe "project" (slug do projeto) para criar uma skill de escopo project.');
        const project = await findProject(userId, projectSlug);
        if (!project) return fail(`Projeto "${projectSlug}" não encontrado.`);
        target = project.id;
      }

      const result = await createSkill(target, { name, description, content: content ?? "" });
      if (!result.ok) return fail(describeFailure(result));

      return {
        ok: true,
        summary: `Skill “${name}” criada (${scopeLabel(where)}${projectSlug ? ` · ${projectSlug}` : ""}).`,
        data: { slug: slugify(name), scope: where, project: projectSlug },
        links: [skillLink()],
        changes: [{ field: "conteúdo", after: content ? `${content.split("\n").length} linhas` : "sem SKILL.md" }],
        mutated: true,
      };
    },
  }),

  update_skill: handler({
    schema: updateSkillArgs,
    async run({ name, description, content, ...ref }, { userId }) {
      const found = await findSkill(userId, ref);
      if ("error" in found) return fail(found.error);
      const { skill } = found;

      const changes: Change[] = [
        ...textChange("nome", skill.name, name),
        ...textChange("descrição", skill.description, description),
        ...contentChange("conteúdo", skill.content ?? "", content),
      ];
      if (changes.length === 0) return { ok: true, summary: `Nada a alterar em “${skill.name}”.`, data: { unchanged: true } };

      const result = await updateSkill(skill.id, {
        name: name ?? skill.name,
        description: description ?? skill.description,
        content: content ?? skill.content ?? "",
      });
      if (!result.ok) return fail(describeFailure(result));

      return { ok: true, summary: `Skill “${name ?? skill.name}” atualizada.`, changes, links: [skillLink()], mutated: true };
    },
  }),

  apply_library_skill: handler({
    schema: applyLibrarySkillArgs,
    async run({ slug: skillSlug, projects: projectSlugs, mode }, { userId }) {
      const found = await findSkill(userId, { slug: skillSlug, scope: "library" });
      if ("error" in found) return fail(found.error);

      const wanted = await findProjects(userId, projectSlugs);
      if (wanted.missing.length > 0) return fail(`Projetos não encontrados: ${wanted.missing.join(", ")}.`);

      const current = await appliedProjectSlugs(found.skill.id);
      const requested = wanted.projects.map((project) => project.id);
      const nextIds =
        mode === "set"
          ? requested
          : mode === "add"
            ? [...new Set([...current.ids, ...requested])]
            : current.ids.filter((id) => !requested.includes(id));

      const result = await setSkillProjects(found.skill.id, nextIds);
      if (!result.ok) return fail(describeFailure(result));

      const after = await appliedProjectSlugs(found.skill.id);
      return {
        ok: true,
        summary: `“${found.skill.name}” aplicada em ${after.slugs.length} ${after.slugs.length === 1 ? "projeto" : "projetos"}.`,
        changes: [{ field: "aplicada em", before: current.slugs.join(", ") || "nenhum", after: after.slugs.join(", ") || "nenhum" }],
        links: [skillLink("Abrir biblioteca")],
        mutated: true,
      };
    },
  }),

  promote_skill: handler({
    schema: promoteSkillArgs,
    async run({ slug: skillSlug, project: projectSlug, target, name, description, content, projects: others, keep_original }, { userId }) {
      const found = await findSkill(userId, { slug: skillSlug, scope: "project", project: projectSlug });
      if ("error" in found) return fail(found.error);
      const { skill } = found;

      const wanted = await findProjects(userId, others ?? []);
      if (wanted.missing.length > 0) return fail(`Projetos não encontrados: ${wanted.missing.join(", ")}.`);

      const result = await promoteSkill(skill.id, {
        name: name ?? skill.name,
        description: description ?? skill.description,
        content: content ?? skill.content ?? "",
        keepOriginal: keep_original ?? false,
        target,
        projectIds: target === "library" ? wanted.projects.map((project) => project.id) : [],
      });
      if (!result.ok) return fail(describeFailure(result));

      return {
        ok: true,
        summary: `“${name ?? skill.name}” promovida para ${target === "library" ? "a biblioteca" : "universal"}${keep_original ? " (cópia mantida no projeto)" : ""}.`,
        changes: [{ field: "escopo", before: `projeto ${projectSlug}`, after: target === "library" ? "biblioteca" : "universal" }],
        links: [skillLink()],
        mutated: true,
      };
    },
  }),

  create_project: handler({
    schema: createProjectArgs,
    async run({ name, slug: wantedSlug, description, library_skills }, { userId }) {
      const libraryIds: string[] = [];
      for (const librarySlug of new Set(library_skills ?? [])) {
        const found = await findSkill(userId, { slug: librarySlug, scope: "library" });
        if ("error" in found) return fail(found.error);
        libraryIds.push(found.skill.id);
      }

      const projectSlug = wantedSlug ?? slugify(name);
      const result = await createProject({
        name,
        slug: projectSlug,
        description: description ?? "",
        repositoryPath: "",
        defaultBranch: "main",
        skills: [],
        librarySkillIds: libraryIds,
      });
      if (!result.ok) return fail(describeFailure(result));

      return {
        ok: true,
        summary: `Projeto “${name}” criado, com o repositório git de contexto${libraryIds.length ? ` e ${libraryIds.length} skill(s) da biblioteca` : ""}.`,
        data: { slug: result.data.slug },
        links: [projectLink(result.data.slug)],
        mutated: true,
      };
    },
  }),

  update_project: handler({
    schema: updateProjectArgs,
    async run({ slug: projectSlug, name, description, default_branch }, { userId }) {
      const project = await findProject(userId, projectSlug);
      if (!project) return fail(`Projeto "${projectSlug}" não encontrado.`);

      const changes: Change[] = [
        ...textChange("nome", project.name, name),
        ...textChange("descrição", project.description, description),
        ...textChange("branch principal", project.defaultBranch, default_branch),
      ];
      if (changes.length === 0) return { ok: true, summary: `Nada a alterar em “${project.name}”.`, data: { unchanged: true } };

      const result = await updateProject(project.id, {
        name: name ?? project.name,
        slug: project.slug,
        description: description ?? project.description,
        repositoryPath: project.repositoryPath ?? "",
        defaultBranch: default_branch ?? project.defaultBranch,
      });
      if (!result.ok) return fail(describeFailure(result));

      return { ok: true, summary: `Projeto “${name ?? project.name}” atualizado.`, changes, links: [projectLink(project.slug)], mutated: true };
    },
  }),

  write_context_file: handler({
    schema: writeContextFileArgs,
    async run({ project: projectSlug, path, content, message }, { userId }) {
      const project = await findProject(userId, projectSlug);
      if (!project) return fail(`Projeto "${projectSlug}" não encontrado.`);

      const secrets = findSecrets(content);
      if (secrets.length > 0) return fail(`O conteúdo parece conter segredos (${secrets.join(", ")}). Remova antes de gravar.`);
      if (!(await ensureRepo(project))) return fail("O repositório de contexto deste projeto está indisponível.");

      try {
        const previous = await contextRepos.read(project.slug, path).then((file) => file.content, () => "");
        const result = await contextRepos.write(project.slug, path, content, { message, author: "Assistente DevBrain" });

        if (!result.changed) return { ok: true, summary: `${result.path} já estava igual; nada foi gravado.`, data: result };

        await logActivity({
          action: "context.written",
          actorId: userId,
          projectId: project.id,
          metadata: { path: result.path, sha: result.sha, source: "assistant" },
        });

        return {
          ok: true,
          summary: `${result.created ? "Criou" : "Atualizou"} ${result.path} (commit ${result.sha?.slice(0, 7)}).`,
          changes: contentChange(result.path, previous, content),
          links: [{ label: "Abrir arquivo", href: `/projects/${project.slug}/files/${result.path.split("/").map(encodeURIComponent).join("/")}` }],
          data: { path: result.path, sha: result.sha },
          mutated: true,
        };
      } catch (error) {
        if (error instanceof RepoError) return fail(error.message);
        throw error;
      }
    },
  }),

  delete_skill: handler({
    schema: deleteSkillArgs,
    async preview(ref, { userId }) {
      const found = await findSkill(userId, ref);
      if ("error" in found) return found.error;
      const applied = found.skill.scope === "library" ? (await appliedProjectSlugs(found.skill.id)).slugs : [];
      return `Remover a skill ${await describeSkill(userId, ref)}${applied.length ? `, hoje aplicada em: ${applied.join(", ")}` : ""}.`;
    },
    async run(ref, { userId }) {
      const found = await findSkill(userId, ref);
      if ("error" in found) return fail(found.error);

      const result = await deleteSkill(found.skill.id);
      if (!result.ok) return fail(describeFailure(result));
      return { ok: true, summary: `Skill “${found.skill.name}” removida.`, links: [skillLink()], mutated: true };
    },
  }),

  delete_project: handler({
    schema: deleteProjectArgs,
    async preview({ slug: projectSlug }, { userId }) {
      const project = await findProject(userId, projectSlug);
      return project
        ? `Remover o projeto “${project.name}” (${project.slug}) com suas skills e tokens. O repositório git vai para a lixeira.`
        : `Projeto "${projectSlug}" não encontrado.`;
    },
    async run({ slug: projectSlug }, { userId }) {
      const project = await findProject(userId, projectSlug);
      if (!project) return fail(`Projeto "${projectSlug}" não encontrado.`);

      const result = await deleteProject(project.id);
      if (!result.ok) return fail(describeFailure(result));
      return { ok: true, summary: `Projeto “${project.name}” removido.`, mutated: true };
    },
  }),
};
