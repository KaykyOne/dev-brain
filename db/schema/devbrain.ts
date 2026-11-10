import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
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
// universal: vale para todos os projetos. library: skill genérica da biblioteca, aplicada só aos projetos escolhidos
// (project_skill_links). project: pertence a um único projeto.
export const skillScope = pgEnum("skill_scope", ["universal", "library", "project"]);
export const logLevel = pgEnum("log_level", ["info", "warn", "error"]);
export const aiProvider = pgEnum("ai_provider", ["deepseek", "openai", "openrouter", "custom"]);
export const proposalStatus = pgEnum("proposal_status", [
  "pending",
  "approved",
  "rejected",
  "published",
  "conflict",
]);

export const taskStatus = pgEnum("task_status", ["queued", "running", "done", "failed", "cancelled"]);
export const taskAgent = pgEnum("task_agent", ["claude", "codex"]);
export const taskBranchMode = pgEnum("task_branch_mode", ["new", "existing"]);
export const taskMessageRole = pgEnum("task_message_role", ["user", "agent", "plan"]);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

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
    // Projeto desativado: o MCP avisa o agente para reativá-lo em vez de atender as ferramentas.
    active: boolean("active").notNull().default(true),
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
// `scope` diz como a skill vale: universal e library não têm projectId; project sempre tem.
export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: skillScope("scope").notNull().default("universal"),
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
    check("skills_scope_project_check", sql`(${table.scope} = 'project') = (${table.projectId} is not null)`),
  ],
);

// Aplicação de uma skill da biblioteca a um projeto. Sem duplicar o conteúdo: o projeto só referencia a skill.
export const projectSkillLinks = pgTable(
  "project_skill_links",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.skillId] }), index("project_skill_links_skill_idx").on(table.skillId)],
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
    // Hash usado na autenticação (o token nunca é comparado em claro).
    tokenHash: text("token_hash").notNull().unique(),
    // Primeiros caracteres do token, só para identificá-lo na interface.
    tokenPrefix: text("token_prefix").notNull(),
    // Token cifrado (AES-256-GCM, lib/security/encryption), para o painel exibi-lo de novo. Nulo nos tokens antigos
    // e nos revogados. A autenticação continua só pelo hash.
    tokenCiphertext: text("token_ciphertext"),
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

// Avisos internos para o dono da conta (ex.: agente pediu aprovação), exibidos no sino do cabeçalho.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    // Tipo do aviso (ex.: "proposal.created", "project.inactive_access"), usado para evitar repetição.
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    // Para onde o clique leva (caminho interno, sem basePath).
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notifications_owner_created_idx").on(table.ownerId, table.createdAt)],
);

// Tamanho de cada resposta do MCP, para estimar os tokens entregues e a economia do contexto fatiado.
// Só o tamanho é guardado, nunca o conteúdo.
export const mcpUsage = pgTable(
  "mcp_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Nulo nas ferramentas do hub (list_projects, create_project).
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    // Chave que fez a chamada: separa as sessões de agentes diferentes.
    tokenId: uuid("token_id").references(() => agentTokens.id, { onDelete: "set null" }),
    tool: text("tool").notNull(),
    responseChars: integer("response_chars").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("mcp_usage_owner_created_idx").on(table.ownerId, table.createdAt),
    index("mcp_usage_project_created_idx").on(table.projectId, table.createdAt),
  ],
);

// Configuração do assistente de IA da conta, editada em Configurações. Sem linha, vale o .env (valor inicial).
export const aiSettings = pgTable("ai_settings", {
  ownerId: uuid("owner_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: aiProvider("provider").notNull().default("deepseek"),
  // Chave de API cifrada (lib/security/app-secret); nunca vai para o navegador.
  apiKeyCiphertext: text("api_key_ciphertext"),
  // Últimos caracteres da chave, só para identificá-la na interface.
  apiKeyHint: text("api_key_hint"),
  model: text("model"),
  baseUrl: text("base_url"),
  thinking: boolean("thinking").notNull().default(false),
  maxSteps: integer("max_steps").notNull().default(12),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Tarefas executadas por agentes (Claude Code, Codex) na máquina do usuário, pela extensão Agent Tasks do VS Code.
// O painel e a extensão cadastram; a extensão reivindica (claim) a próxima da fila, executa e reporta o resultado.
export const agentTasks = pgTable(
  "agent_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    agent: taskAgent("agent").notNull().default("claude"),
    // new: cria a branch (nome em `branch`, ou nulo para a IA sugerir) a partir de `baseBranch`. existing: usa `branch`.
    branchMode: taskBranchMode("branch_mode").notNull().default("new"),
    branch: text("branch"),
    baseBranch: text("base_branch"),
    // Ordem na fila (menor sai primeiro).
    position: bigint("position", { mode: "number" }).notNull(),
    status: taskStatus("status").notNull().default("queued"),
    // Onde foi cadastrada (ex.: "web", "vscode:notebook").
    source: text("source").notNull(),
    // Máquina que está executando (ou executou) a tarefa.
    runner: text("runner"),
    // Branch em que o trabalho ficou (pode ter sido renomeada pela IA).
    resultBranch: text("result_branch"),
    summary: text("summary"),
    error: text("error"),
    // Fim do log da execução, enviado pela extensão durante e ao final.
    logTail: text("log_tail"),
    committed: boolean("committed").notNull().default(false),
    // Modelos (aliases da CLI do agente). Nulo = padrão da CLI.
    planModel: text("plan_model"),
    execModel: text("exec_model"),
    // Antes de executar, o modelo de planejamento gera um plano (sem alterar arquivos).
    planFirst: boolean("plan_first").notNull().default(false),
    plan: text("plan"),
    // Sessão do agente na máquina que executou: permite continuar a conversa (só nela, em `runner`).
    sessionId: text("session_id"),
    cancelRequestedAt: timestamp("cancel_requested_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("agent_tasks_project_status_position_idx").on(table.projectId, table.status, table.position),
    index("agent_tasks_owner_created_idx").on(table.ownerId, table.createdAt),
  ],
);

// Arquivos anexados às instruções da tarefa (imagens, logs, specs). Guardados no banco: são poucos e pequenos.
export const agentTaskAttachments = pgTable(
  "agent_task_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => agentTasks.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    content: bytea("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("agent_task_attachments_task_idx").on(table.taskId)],
);

// Conversa da tarefa: o pedido inicial é o próprio `prompt`; aqui ficam o plano, as respostas do agente e as
// mensagens de continuação do usuário.
export const agentTaskMessages = pgTable(
  "agent_task_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => agentTasks.id, { onDelete: "cascade" }),
    role: taskMessageRole("role").notNull(),
    content: text("content").notNull(),
    // Continuação: modelo pedido pelo usuário. Resposta: modelo que respondeu (quando conhecido).
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("agent_task_messages_task_created_idx").on(table.taskId, table.createdAt)],
);

export type AgentTask = typeof agentTasks.$inferSelect;
export type AgentTaskMessage = typeof agentTaskMessages.$inferSelect;
export type AgentTaskStatus = (typeof taskStatus.enumValues)[number];
export type AgentTaskAttachment = typeof agentTaskAttachments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AppLog = typeof appLogs.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type SkillScope = (typeof skillScope.enumValues)[number];
export type ContextFile = typeof contextFiles.$inferSelect;
export type ChangeProposal = typeof changeProposals.$inferSelect;
export type ContextCategory = (typeof contextCategory.enumValues)[number];
