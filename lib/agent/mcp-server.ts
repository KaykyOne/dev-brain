import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { changeProposals, contextCategory, contextFiles } from "@/db/schema";

import type { AgentContext } from "./auth";
import { findSkillForProject, listProjectSkills, listUniversalSkills } from "@/lib/skills/queries";
import { skillRepoPath } from "@/lib/skills/paths";
import { createAgentProposal, proposeChangeSchema } from "./proposals";
import type { AgentScope } from "./scopes";

const json = (data: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

const error = (message: string): CallToolResult => ({
  isError: true,
  content: [{ type: "text", text: message }],
});

/** Cria um servidor MCP isolado por requisição, restrito ao projeto e aos escopos do token. */
export function createMcpServer(context: AgentContext) {
  const server = new McpServer(
    { name: "devbrain", version: "0.1.0" },
    {
      instructions:
        "DevBrain centraliza o contexto do projeto para agentes. Consulte os arquivos de contexto antes de " +
        "alterar o código e use propose_change para registrar conhecimento novo. Propostas passam por revisão humana.",
    },
  );

  const projectId = context.project.id;
  const requireScope = (scope: AgentScope) =>
    context.scopes.includes(scope) ? null : error(`O token não possui o escopo "${scope}".`);

  server.registerTool(
    "get_project",
    {
      title: "Dados do projeto",
      description: "Retorna os metadados do projeto vinculado a este token.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const denied = requireScope("context:read");
      if (denied) return denied;

      const { name, slug, description, repositoryPath, defaultBranch, syncStatus, lastSyncedAt } = context.project;
      return json({ name, slug, description, repositoryPath, defaultBranch, syncStatus, lastSyncedAt });
    },
  );

  server.registerTool(
    "list_context_files",
    {
      title: "Listar arquivos de contexto",
      description:
        "Lista os arquivos de contexto sincronizados do projeto (caminho, categoria e último commit). " +
        "Os caminhos são relativos ao diretório do projeto no repositório.",
      inputSchema: { category: z.enum(contextCategory.enumValues).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ category }) => {
      const denied = requireScope("context:read");
      if (denied) return denied;

      const files = await db
        .select({
          path: contextFiles.path,
          category: contextFiles.category,
          lastCommitSha: contextFiles.lastCommitSha,
          lastSyncedAt: contextFiles.lastSyncedAt,
        })
        .from(contextFiles)
        .where(
          and(eq(contextFiles.projectId, projectId), category ? eq(contextFiles.category, category) : undefined),
        )
        .orderBy(contextFiles.path);

      return json({ files });
    },
  );

  server.registerTool(
    "list_skills",
    {
      title: "Listar skills",
      description:
        "Lista as skills que valem para este projeto: as universais (todos os projetos) e as específicas dele. " +
        "Cada skill traz nome, descrição (quando usar) e o caminho do SKILL.md no repositório.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const denied = requireScope("context:read");
      if (denied) return denied;

      const { project } = context;
      const [universal, specific] = await Promise.all([
        listUniversalSkills(project.ownerId),
        listProjectSkills(project.id),
      ]);

      const toEntry = (skill: (typeof universal)[number], scoped: boolean) => ({
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        scope: scoped ? "project" : "universal",
        path: skillRepoPath({ slug: skill.slug, project: scoped ? project : null }),
      });

      return json({
        skills: [...universal.map((skill) => toEntry(skill, false)), ...specific.map((skill) => toEntry(skill, true))],
      });
    },
  );

  server.registerTool(
    "get_skill",
    {
      title: "Ler uma skill",
      description:
        "Retorna o SKILL.md completo de uma skill (universal ou deste projeto), pelo slug obtido em list_skills. " +
        "Se houver uma skill do projeto com o mesmo slug de uma universal, a do projeto prevalece.",
      inputSchema: { slug: z.string().min(1).max(100) },
      annotations: { readOnlyHint: true },
    },
    async ({ slug }) => {
      const denied = requireScope("context:read");
      if (denied) return denied;

      const skill = await findSkillForProject(context.project, slug);
      if (!skill) return error("Skill não encontrada.");

      return json({
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        scope: skill.projectId ? "project" : "universal",
        content: skill.content,
      });
    },
  );

  server.registerTool(
    "propose_change",
    {
      title: "Propor alteração de contexto",
      description:
        "Propõe criar ou atualizar um arquivo Markdown de contexto, memória ou decisão. A proposta fica pendente " +
        "até revisão humana; nada é publicado automaticamente. Não inclua segredos.",
      inputSchema: {
        file_path: z.string().describe("Caminho .md relativo ao diretório do projeto, ex.: memory/cache.md"),
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

  return server;
}
