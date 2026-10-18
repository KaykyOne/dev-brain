import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const syncStatus = pgEnum("sync_status", ["never", "synced", "failed"]);
export const syncLogStatus = pgEnum("sync_log_status", ["success", "failed"]);
export const contextCategory = pgEnum("context_category", [
  "context",
  "architecture",
  "rule",
  "decision",
  "memory",
  "skill",
]);
export const logLevel = pgEnum("log_level", ["info", "warn", "error"]);
export const proposalStatus = pgEnum("proposal_status", [
  "pending",
  "approved",
  "rejected",
  "published",
  "conflict",
]);

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider", { enum: ["github"] }).notNull().default("github"),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    installationId: bigint("installation_id", { mode: "number" }),
    defaultBranch: text("default_branch").notNull().default("main"),
    ...timestamps,
  },
  (table) => [unique("repositories_provider_owner_name_key").on(table.provider, table.owner, table.name)],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    repositoryId: uuid("repository_id").references(() => repositories.id, { onDelete: "set null" }),
    // Caminho do projeto dentro do repositório, relativo à raiz (ex.: devbrain/projects/meu-projeto).
    repositoryPath: text("repository_path"),
    defaultBranch: text("default_branch").notNull().default("main"),
    syncStatus: syncStatus("sync_status").notNull().default("never"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("projects_owner_id_idx").on(table.ownerId)],
);

// Apenas metadados: o conteúdo dos arquivos vive no Git.
export const contextFiles = pgTable(
  "context_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    category: contextCategory("category").notNull(),
    lastCommitSha: text("last_commit_sha"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  },
  (table) => [unique("context_files_project_path_key").on(table.projectId, table.path)],
);

// Registro de skills. `content` é o SKILL.md importado (cópia de trabalho até ser publicado no Git);
// o caminho no repositório é derivado do slug.
// projectId nulo = skill universal (vale para todos os projetos do dono).
export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull(),
    content: text("content"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("skills_universal_slug_key").on(table.ownerId, table.slug).where(sql`${table.projectId} is null`),
    unique("skills_project_slug_key").on(table.projectId, table.slug),
    index("skills_owner_id_idx").on(table.ownerId),
  ],
);

export const changeProposals = pgTable(
  "change_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    filePath: text("file_path").notNull(),
    baseCommitSha: text("base_commit_sha"),
    proposedContent: text("proposed_content").notNull(),
    reason: text("reason").notNull(),
    // Origem da proposta (ex.: "user", "agent:claude-code").
    source: text("source").notNull(),
    // Referência ao commit/PR do código que motivou a proposta, quando houver.
    codeReference: text("code_reference"),
    status: proposalStatus("status").notNull().default("pending"),
    pullRequestUrl: text("pull_request_url"),
    // Aprovação, publicação e falha são registradas separadamente.
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    ...timestamps,
  },
  (table) => [index("change_proposals_project_status_idx").on(table.projectId, table.status)],
);

export const agentTokens = pgTable(
  "agent_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Nulo = token de conta (hub): lista e cria projetos, sem acesso ao conteúdo de nenhum deles.
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Somente o hash é armazenado; o token em claro é exibido uma única vez.
    tokenHash: text("token_hash").notNull().unique(),
    // Primeiros caracteres do token, só para identificá-lo na interface.
    tokenPrefix: text("token_prefix").notNull(),
    scopes: text("scopes").array().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("agent_tokens_project_id_idx").on(table.projectId)],
);

export const syncLogs = pgTable(
  "sync_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: syncLogStatus("status").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sync_logs_project_created_idx").on(table.projectId, table.createdAt)],
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Preservado (null) quando o projeto é removido, para manter o histórico.
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("activity_logs_actor_created_idx").on(table.actorId, table.createdAt)],
);

// Logs da aplicação (erros, avisos e eventos de diagnóstico), exibidos na página Logs.
export const appLogs = pgTable(
  "app_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    level: logLevel("level").notNull(),
    // Origem do log (ex.: "projects", "mcp", "startup", "request").
    scope: text("scope").notNull(),
    message: text("message").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    stack: text("stack"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("app_logs_created_idx").on(table.createdAt),
    index("app_logs_level_created_idx").on(table.level, table.createdAt),
  ],
);

export type AppLog = typeof appLogs.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type ContextFile = typeof contextFiles.$inferSelect;
export type ChangeProposal = typeof changeProposals.$inferSelect;
export type ContextCategory = (typeof contextCategory.enumValues)[number];
