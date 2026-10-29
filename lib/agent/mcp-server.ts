import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { changeProposals, projects, type Project } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { contextRepos, RepoError } from "@/lib/context-repo";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { notify } from "@/lib/notifications";
import { createProjectWithRepo } from "@/lib/projects/create";
import { findSecrets } from "@/lib/security/secrets";
import {
  findSkillForProject,
  listLinkedLibrarySkills,
  listProjectSkills,
  listUniversalSkills,
} from "@/lib/skills/queries";
import { skillRepoPath } from "@/lib/skills/paths";
import { slugify, SLUG_PATTERN } from "@/lib/slug";

import type { AgentContext } from "./auth";
import { createAgentProposal, proposeChangeSchema } from "./proposals";

const json = (data: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

const error = (message: string): CallToolResult => ({
  isError: true,
  content: [{ type: "text", text: message }],
});

/** Erros esperados do repositório viram mensagem para o agente; o resto não vaza detalhes do servidor. */
async function guard(task: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await task();
  } catch (failure) {
    if (failure instanceof RepoError) return error(failure.message);
    await logger.error("mcp", "Falha em ferramenta MCP", { error: failure });
    return error("Erro interno ao acessar o repositório de contexto.");
  }
}

const INSTRUCTIONS =
  "DevBrain é um hub de repositórios git de contexto de projetos, todos no mesmo padrão (README com índice " +
  "'quando carregar', 00-base.md, skills/, tasks/, notas/, templates-pr/, raiz/). Um único servidor atende todos os " +
  "projetos: o AGENTS.md do projeto de código diz qual é o slug do projeto no DevBrain; passe-o no argumento `project` " +
  "de toda ferramenta. Se o AGENTS.md não indicar o projeto, chame list_projects e pergunte ao usuário qual usar. " +
  "ANTES de alterar código, é OBRIGATÓRIO ler README.md, skills/ e 00-base.md (read_context_file) e registrar o que " +
  "aprender com write_context_file, que cria um commit local por gravação (push não existe). Só projetos ativos " +
  "atendem as ferramentas; se um estiver desativado, avise o usuário para reativá-lo.";

const projectArg = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe("Slug do projeto no DevBrain, indicado no AGENTS.md do projeto de código (ou em list_projects)");

/** Cria um servidor MCP isolado por requisição. O projeto de cada ferramenta vem do argumento `project`. */
export function createMcpServer(context: AgentContext) {
  const server = new McpServer({ name: "devbrain", version: "0.3.0" }, { instructions: INSTRUCTIONS });

  /** Resolve o projeto da conta pelo slug. Desativado ou inexistente vira um erro que orienta o agente. */
  async function resolveProject(slug: string): Promise<{ project: Project } | { denied: CallToolResult }> {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, context.ownerId), eq(projects.slug, slug)))
      .limit(1);

    if (!project) {
      return {
        denied: error(
          `Projeto "${slug}" não encontrado no DevBrain. Confira o slug no AGENTS.md ou chame list_projects; ` +
            "não use o contexto de outro projeto sem o usuário confirmar.",
        ),
      };
    }

    if (!project.active) {
      await notify({
        ownerId: context.ownerId,
        projectId: project.id,
        kind: "project.inactive_access",
        title: "IA tentou usar um projeto desativado",
        body: `${project.name}: o agente "${context.tokenName}" foi avisado para pedir a reativação.`,
        href: "/mcp",
        dedupe: true,
      });
      return {
        denied: error(
          `O projeto "${project.name}" está desativado no MCP do DevBrain. Avise o usuário para ativá-lo ` +
            "(página MCP → Projetos, ou Projetos → " +
            `${project.name} → Configurações) e só então tente de novo. Não prossiga sem o contexto do projeto.`,
        ),
      };
    }

    return { project };
  }

  /** Projetos anteriores ao hub ganham o repositório no primeiro acesso. */
  const ensureRepo = (project: Project) =>
    contextRepos.init({ name: project.name, slug: project.slug, description: project.description }, project.defaultBranch);

  /** Envolve uma ferramenta de projeto: resolve o slug, garante o repositório e trata os erros. */
  const withProject =
    <A extends { project: string }>(task: (project: Project, args: A) => Promise<CallToolResult>) =>
    (args: A) =>
      guard(async () => {
        const resolved = await resolveProject(args.project);
        if ("denied" in resolved) return resolved.denied;
        await ensureRepo(resolved.project);
        return task(resolved.project, args);
      });

  server.registerTool(
    "list_projects",
    {
      title: "Listar projetos do hub",
      description:
        "Lista os projetos (repositórios de contexto) da conta, com slug, descrição e se está ativo (active). " +
        "Só projetos ativos atendem as ferramentas; use o slug no argumento `project`.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const rows = await db
        .select({
          name: projects.name,
          slug: projects.slug,
          description: projects.description,
          defaultBranch: projects.defaultBranch,
          active: projects.active,
          createdAt: projects.createdAt,
        })
        .from(projects)
        .where(eq(projects.ownerId, context.ownerId))
        .orderBy(desc(projects.updatedAt));

      return json({ projects: rows });
    },
  );

  server.registerTool(
    "create_project",
    {
      title: "Iniciar um novo projeto",
      description:
        "Cria um projeto e o seu repositório git de contexto já no padrão do hub (README com índice, 00-base.md, " +
        "skills/, tasks/, notas/, templates-pr/ e raiz/ com AGENTS.md, CLAUDE.md e .claude/settings.json), com o " +
        "commit inicial feito. O projeto nasce ativo e já atende as demais ferramentas pelo slug devolvido.",
      inputSchema: {
        name: z.string().trim().min(1).max(80).describe("Nome do projeto"),
        description: z.string().trim().max(500).optional().describe("O que o projeto faz; entra no 00-base.md"),
        slug: z.string().trim().min(2).max(60).optional().describe("Identificador (minúsculas, números, hífens). Padrão: derivado do nome"),
        default_branch: z.string().trim().regex(/^[\w-]+(?:\/[\w-]+)*$/).max(100).optional().describe("Branch principal do repositório. Padrão: main"),
      },
    },
    async (args) =>
      guard(async () => {
        const slug = args.slug ?? slugify(args.name);
        if (!SLUG_PATTERN.test(slug) || slug.length < 2) {
          return error("Não foi possível derivar um slug válido; informe `slug` (minúsculas, números e hífens).");
        }

        const defaultBranch = args.default_branch ?? "main";
        const created = await createProjectWithRepo({
          ownerId: context.ownerId,
          values: { name: args.name, slug, description: args.description ?? "", defaultBranch },
        });
        if (!created.ok) return error(created.fieldErrors?.slug?.[0] ?? created.error);

        const [files, summary] = await Promise.all([contextRepos.files(slug), contextRepos.summary(slug)]);

        return json({
          project: { name: args.name, slug, defaultBranch, url: `${env.APP_URL}/projects/${slug}` },
          repository: { commits: summary.commits, head: summary.head, files },
          next_steps: [
            `Use project: "${slug}" nas demais ferramentas.`,
            "Preencha 00-base.md e o README.md com write_context_file.",
            "Copie os arquivos de raiz/ (AGENTS.md, CLAUDE.md, .claude/settings.json) para a raiz do projeto de código: " +
              "o AGENTS.md já indica o slug do projeto.",
          ],
        });
      }),
  );

  server.registerTool(
    "get_project",
    {
      title: "Dados do projeto",
      description: "Retorna os metadados do projeto e o estado do repositório git de contexto.",
      inputSchema: { project: projectArg },
      annotations: { readOnlyHint: true },
    },
    withProject(async (project) => {
      const { commits, head } = await contextRepos.summary(project.slug);
      const { name, slug, description, defaultBranch } = project;
      return json({ name, slug, description, defaultBranch, repository: { commits, head } });
    }),
  );

  server.registerTool(
    "list_context_files",
    {
      title: "Listar arquivos de contexto",
      description:
        "Lista os arquivos versionados no repositório de contexto do projeto (caminhos relativos à raiz do repositório). " +
        "Comece pelo README.md, que indica quando carregar cada arquivo.",
      inputSchema: {
        project: projectArg,
        prefix: z.string().max(200).optional().describe("Filtra por pasta, ex.: skills/ ou notas/"),
      },
      annotations: { readOnlyHint: true },
    },
    withProject(async (project, { prefix }) => {
      const files = await contextRepos.files(project.slug);
      return json({ files: prefix ? files.filter((file) => file.startsWith(prefix)) : files });
    }),
  );

  server.registerTool(
    "read_context_file",
    {
      title: "Ler arquivo de contexto",
      description: "Lê o conteúdo de um arquivo do repositório de contexto (ex.: README.md, 00-base.md, skills/nova-task.md).",
      inputSchema: { project: projectArg, path: z.string().min(1).max(300).describe("Caminho relativo à raiz do repositório") },
      annotations: { readOnlyHint: true },
    },
    withProject(async (project, { path }) => json(await contextRepos.read(project.slug, path))),
  );

  server.registerTool(
    "write_context_file",
    {
      title: "Gravar arquivo de contexto",
      description:
        "Cria ou substitui um arquivo do repositório de contexto e faz UM commit local só com ele (sem push). " +
        "Siga o padrão do repositório: um commit por assunto, mensagem em pt-BR com prefixo (feat:, docs:, fix:, chore:). " +
        "Extensões aceitas: .md, .txt, .json, .yaml, .yml, .py. Não inclua segredos.",
      inputSchema: {
        project: projectArg,
        path: z.string().min(1).max(300).describe("Caminho relativo à raiz do repositório, ex.: notas/2026-01-10-cache.md"),
        content: z.string().max(400_000).describe("Conteúdo completo do arquivo"),
        commit_message: z.string().trim().min(1).max(200).describe("Mensagem do commit, uma linha. Ex.: docs: registrar decisão de cache"),
      },
    },
    withProject(async (project, { path, content, commit_message }) => {
      const secrets = findSecrets(content);
      if (secrets.length > 0) {
        return error(`O conteúdo parece conter segredos (${secrets.join(", ")}). Remova antes de gravar.`);
      }

      const result = await contextRepos.write(project.slug, path, content, {
        message: commit_message,
        author: context.tokenName,
      });

      if (result.changed) {
        await logActivity({
          action: "context.written",
          projectId: project.id,
          metadata: { path: result.path, sha: result.sha, source: `agent:${context.tokenName}` },
        });
      }

      return json(result);
    }),
  );

  server.registerTool(
    "repo_log",
    {
      title: "Histórico do repositório",
      description: "Lista os commits mais recentes do repositório de contexto.",
      inputSchema: {
        project: projectArg,
        limit: z.number().int().min(1).max(100).optional().describe("Quantidade (padrão 20)"),
      },
      annotations: { readOnlyHint: true },
    },
    withProject(async (project, { limit }) => json({ commits: await contextRepos.log(project.slug, limit ?? 20) })),
  );

  server.registerTool(
    "list_skills",
    {
      title: "Listar skills",
      description:
        "Lista as skills cadastradas no DevBrain que valem para o projeto: as universais (todos os projetos), as da " +
        "biblioteca aplicadas a ele e as específicas dele (scope: universal | library | project). As regras do próprio " +
        "repositório ficam em skills/ (list_context_files).",
      inputSchema: { project: projectArg },
      annotations: { readOnlyHint: true },
    },
    withProject(async (project) => {
      const [universal, library, specific] = await Promise.all([
        listUniversalSkills(project.ownerId),
        listLinkedLibrarySkills(project.id),
        listProjectSkills(project.id),
      ]);

      const toEntry = (skill: (typeof universal)[number]) => ({
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        scope: skill.scope,
        path: skillRepoPath({ slug: skill.slug, project: skill.scope === "project" ? project : null, library: skill.scope === "library" }),
      });

      return json({ skills: [...universal, ...library, ...specific].map(toEntry) });
    }),
  );

  server.registerTool(
    "get_skill",
    {
      title: "Ler uma skill",
      description:
        "Retorna o SKILL.md completo de uma skill cadastrada (universal, da biblioteca ou do projeto), pelo slug obtido " +
        "em list_skills. Com o mesmo slug em mais de um escopo, prevalece a mais específica: projeto, depois biblioteca, " +
        "depois universal.",
      inputSchema: { project: projectArg, slug: z.string().min(1).max(100).describe("Slug da skill") },
      annotations: { readOnlyHint: true },
    },
    withProject(async (project, { slug }) => {
      const skill = await findSkillForProject(project, slug);
      if (!skill) return error("Skill não encontrada.");

      return json({
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        scope: skill.scope,
        content: skill.content,
      });
    }),
  );

  server.registerTool(
    "propose_change",
    {
      title: "Propor alteração de contexto",
      description:
        "Propõe criar ou atualizar um arquivo Markdown de contexto para revisão humana: a proposta fica pendente e nada " +
        "é gravado no repositório. Use quando a mudança precisar de aprovação. Não inclua segredos.",
      inputSchema: {
        project: projectArg,
        file_path: z.string().describe("Caminho .md relativo à raiz do repositório, ex.: notas/cache.md"),
        content: z.string().describe("Conteúdo Markdown completo proposto para o arquivo"),
        reason: z.string().describe("Por que esta alteração é necessária"),
        code_reference: z.string().optional().describe("Commit ou PR do código que motivou a proposta"),
      },
    },
    withProject(async (project, args) => {
      // O esquema descarta o `project` (chaves desconhecidas não passam).
      const parsed = proposeChangeSchema.safeParse(args);
      if (!parsed.success) return error(z.prettifyError(parsed.error));

      const result = await createAgentProposal(context, project, parsed.data);
      return result.ok ? json(result) : error(result.error);
    }),
  );

  server.registerTool(
    "get_change",
    {
      title: "Consultar proposta",
      description: "Consulta o estado de uma proposta de alteração do projeto.",
      inputSchema: { project: projectArg, id: z.uuid() },
      annotations: { readOnlyHint: true },
    },
    withProject(async (project, { id }) => {
      const [proposal] = await db
        .select({
          id: changeProposals.id,
          filePath: changeProposals.filePath,
          status: changeProposals.status,
          reason: changeProposals.reason,
          pullRequestUrl: changeProposals.pullRequestUrl,
          failureReason: changeProposals.failureReason,
          createdAt: changeProposals.createdAt,
        })
        .from(changeProposals)
        .where(and(eq(changeProposals.id, id), eq(changeProposals.projectId, project.id)))
        .limit(1);

      return proposal ? json(proposal) : error("Proposta não encontrada.");
    }),
  );

  return server;
}
