import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { changeProposals, projects } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { contextRepos, RepoError } from "@/lib/context-repo";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
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
import { issueAgentToken } from "./issue";
import { createAgentProposal, proposeChangeSchema } from "./proposals";
import type { AgentScope } from "./scopes";

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
  "'quando carregar', 00-base.md, skills/, tasks/, notas/, templates-pr/, raiz/). " +
  "Com token de projeto: ANTES de alterar código, é OBRIGATÓRIO ler README.md, skills/ e 00-base.md (read_context_file) " +
  "e registrar o que aprender com write_context_file, que cria um commit local por gravação (push não existe). " +
  "Com token de conta: list_projects e create_project iniciam um novo repositório já no padrão.";

/** Cria um servidor MCP isolado por requisição: ferramentas de projeto ou de conta, conforme o token. */
export function createMcpServer(context: AgentContext) {
  const server = new McpServer({ name: "devbrain", version: "0.2.0" }, { instructions: INSTRUCTIONS });

  const requireScope = (scope: AgentScope) =>
    context.scopes.includes(scope) ? null : error(`O token não possui o escopo "${scope}".`);

  if (context.project) registerProjectTools(server, context, context.project, requireScope);
  else registerAccountTools(server, context, requireScope);

  return server;
}

type RequireScope = (scope: AgentScope) => CallToolResult | null;

function registerAccountTools(server: McpServer, context: AgentContext, requireScope: RequireScope) {
  server.registerTool(
    "list_projects",
    {
      title: "Listar projetos do hub",
      description: "Lista os projetos (repositórios de contexto) da conta, com slug e descrição.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const denied = requireScope("projects:create");
      if (denied) return denied;

      const rows = await db
        .select({
          name: projects.name,
          slug: projects.slug,
          description: projects.description,
          defaultBranch: projects.defaultBranch,
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
        "commit inicial feito. Por padrão também emite um token do projeto (leitura, escrita e propostas), exibido " +
        "uma única vez: use-o para conectar o agente ao projeto novo.",
      inputSchema: {
        name: z.string().trim().min(1).max(80).describe("Nome do projeto"),
        description: z.string().trim().max(500).optional().describe("O que o projeto faz; entra no 00-base.md"),
        slug: z.string().trim().min(2).max(60).optional().describe("Identificador (minúsculas, números, hífens). Padrão: derivado do nome"),
        default_branch: z.string().trim().regex(/^[\w-]+(?:\/[\w-]+)*$/).max(100).optional().describe("Branch principal do repositório. Padrão: main"),
        issue_token: z.boolean().optional().describe("Emitir token do projeto junto. Padrão: true"),
      },
    },
    async (args) =>
      guard(async () => {
        const denied = requireScope("projects:create");
        if (denied) return denied;

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

        const endpoint = `${env.APP_URL}/api/mcp`;
        const [files, summary] = await Promise.all([contextRepos.files(slug), contextRepos.summary(slug)]);

        const issued =
          args.issue_token === false
            ? null
            : await issueAgentToken({
                ownerId: context.ownerId,
                projectId: created.data.id,
                name: `Agente — ${args.name}`.slice(0, 60),
                scopes: ["context:read", "context:write", "changes:propose"],
                expiresInDays: 365,
              });

        return json({
          project: { name: args.name, slug, defaultBranch, url: `${env.APP_URL}/projects/${slug}` },
          repository: { commits: summary.commits, head: summary.head, files },
          token: issued
            ? {
                value: issued.token,
                scopes: ["context:read", "context:write", "changes:propose"],
                expiresAt: issued.expiresAt,
                note: "Exibido uma única vez. Não o grave em arquivos versionados.",
              }
            : null,
          connect: issued
            ? `claude mcp add --transport http --scope user devbrain-${slug} ${endpoint} --header "Authorization: Bearer ${issued.token}"`
            : null,
          next_steps: [
            "Conecte o agente ao projeto com o comando em `connect` (ou crie um token na página /mcp).",
            "Com o token do projeto: preencha 00-base.md e o README.md com write_context_file.",
            "Copie os arquivos de raiz/ (AGENTS.md, CLAUDE.md, .claude/settings.json) para a raiz do projeto de código.",
          ],
        });
      }),
  );
}

function registerProjectTools(
  server: McpServer,
  context: AgentContext,
  project: NonNullable<AgentContext["project"]>,
  requireScope: RequireScope,
) {
  const projectId = project.id;
  const slug = project.slug;

  /** Projetos anteriores ao hub ganham o repositório no primeiro acesso. */
  const ensureRepo = () =>
    contextRepos.init(
      { name: project.name, slug, description: project.description },
      project.defaultBranch,
    );

  server.registerTool(
    "get_project",
    {
      title: "Dados do projeto",
      description: "Retorna os metadados do projeto vinculado a este token e o estado do repositório git de contexto.",
      annotations: { readOnlyHint: true },
    },
    async () =>
      guard(async () => {
        const denied = requireScope("context:read");
        if (denied) return denied;

        await ensureRepo();
        const { commits, head } = await contextRepos.summary(slug);
        const { name, description, defaultBranch } = project;
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
      inputSchema: { prefix: z.string().max(200).optional().describe("Filtra por pasta, ex.: skills/ ou notas/") },
      annotations: { readOnlyHint: true },
    },
    async ({ prefix }) =>
      guard(async () => {
        const denied = requireScope("context:read");
        if (denied) return denied;

        await ensureRepo();
        const files = await contextRepos.files(slug);
        return json({ files: prefix ? files.filter((file) => file.startsWith(prefix)) : files });
      }),
  );

  server.registerTool(
    "read_context_file",
    {
      title: "Ler arquivo de contexto",
      description: "Lê o conteúdo de um arquivo do repositório de contexto (ex.: README.md, 00-base.md, skills/nova-task.md).",
      inputSchema: { path: z.string().min(1).max(300).describe("Caminho relativo à raiz do repositório") },
      annotations: { readOnlyHint: true },
    },
    async ({ path }) =>
      guard(async () => {
        const denied = requireScope("context:read");
        if (denied) return denied;

        await ensureRepo();
        return json(await contextRepos.read(slug, path));
      }),
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
        path: z.string().min(1).max(300).describe("Caminho relativo à raiz do repositório, ex.: notas/2026-01-10-cache.md"),
        content: z.string().max(400_000).describe("Conteúdo completo do arquivo"),
        commit_message: z.string().trim().min(1).max(200).describe("Mensagem do commit, uma linha. Ex.: docs: registrar decisão de cache"),
      },
    },
    async ({ path, content, commit_message }) =>
      guard(async () => {
        const denied = requireScope("context:write");
        if (denied) return denied;

        const secrets = findSecrets(content);
        if (secrets.length > 0) {
          return error(`O conteúdo parece conter segredos (${secrets.join(", ")}). Remova antes de gravar.`);
        }

        await ensureRepo();
        const result = await contextRepos.write(slug, path, content, {
          message: commit_message,
          author: context.tokenName,
        });

        if (result.changed) {
          await logActivity({
            action: "context.written",
            projectId,
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
      inputSchema: { limit: z.number().int().min(1).max(100).optional().describe("Quantidade (padrão 20)") },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) =>
      guard(async () => {
        const denied = requireScope("context:read");
        if (denied) return denied;

        await ensureRepo();
        return json({ commits: await contextRepos.log(slug, limit ?? 20) });
      }),
  );

  server.registerTool(
    "list_skills",
    {
      title: "Listar skills",
      description:
        "Lista as skills cadastradas no DevBrain que valem para este projeto: as universais (todos os projetos), as da " +
        "biblioteca aplicadas a ele e as específicas dele (scope: universal | library | project). As regras do próprio " +
        "repositório ficam em skills/ (list_context_files).",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const denied = requireScope("context:read");
      if (denied) return denied;

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
    },
  );

  server.registerTool(
    "get_skill",
    {
      title: "Ler uma skill",
      description:
        "Retorna o SKILL.md completo de uma skill cadastrada (universal, da biblioteca ou deste projeto), pelo slug obtido " +
        "em list_skills. Com o mesmo slug em mais de um escopo, prevalece a mais específica: projeto, depois biblioteca, " +
        "depois universal.",
      inputSchema: { slug: z.string().min(1).max(100) },
      annotations: { readOnlyHint: true },
    },
    async ({ slug: skillSlug }) => {
      const denied = requireScope("context:read");
      if (denied) return denied;

      const skill = await findSkillForProject(project, skillSlug);
      if (!skill) return error("Skill não encontrada.");

      return json({
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        scope: skill.scope,
        content: skill.content,
      });
    },
  );

  server.registerTool(
    "propose_change",
    {
      title: "Propor alteração de contexto",
      description:
        "Propõe criar ou atualizar um arquivo Markdown de contexto para revisão humana: a proposta fica pendente e nada " +
        "é gravado no repositório. Use quando o token não tiver context:write ou a mudança precisar de aprovação. " +
        "Não inclua segredos.",
      inputSchema: {
        file_path: z.string().describe("Caminho .md relativo à raiz do repositório, ex.: notas/cache.md"),
        content: z.string().describe("Conteúdo Markdown completo proposto para o arquivo"),
        reason: z.string().describe("Por que esta alteração é necessária"),
        code_reference: z.string().optional().describe("Commit ou PR do código que motivou a proposta"),
      },
    },
    async (args) => {
      const denied = requireScope("changes:propose");
      if (denied) return denied;

      const parsed = proposeChangeSchema.safeParse(args);
      if (!parsed.success) return error(z.prettifyError(parsed.error));

      const result = await createAgentProposal(context, parsed.data);
      return result.ok ? json(result) : error(result.error);
    },
  );

  server.registerTool(
    "get_change",
    {
      title: "Consultar proposta",
      description: "Consulta o estado de uma proposta de alteração criada por este projeto.",
      inputSchema: { id: z.uuid() },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const denied = requireScope("changes:propose");
      if (denied) return denied;

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
        .where(and(eq(changeProposals.id, id), eq(changeProposals.projectId, projectId)))
        .limit(1);

      return proposal ? json(proposal) : error("Proposta não encontrada.");
    },
  );
}
