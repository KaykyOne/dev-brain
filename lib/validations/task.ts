import { z } from "zod";

import { SLUG_PATTERN } from "@/lib/slug";

/** Limites dos anexos: guardados no banco, então são pequenos por design. */
export const TASK_ATTACHMENT_LIMITS = {
  maxFiles: 10,
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 25 * 1024 * 1024,
} as const;

export const TASK_AGENTS = ["claude", "codex"] as const;
export const TASK_AGENT_LABELS: Record<(typeof TASK_AGENTS)[number], string> = {
  claude: "Claude Code",
  codex: "Codex",
};

/** Sugestões de modelo por agente (o campo aceita qualquer alias/id que a CLI entenda). */
export const MODEL_SUGGESTIONS: Record<(typeof TASK_AGENTS)[number], string[]> = {
  claude: ["opus", "sonnet", "haiku"],
  codex: [],
};

/** Nome de branch git razoável: sem espaços, `..`, `~^:?*[\` nem barra no início/fim. */
export const isValidBranchName = (name: string) =>
  /^[\w./-]+$/.test(name) &&
  !name.includes("..") &&
  !name.includes("//") &&
  !name.startsWith("/") &&
  !name.endsWith("/") &&
  !name.endsWith(".lock") &&
  !name.startsWith("-");

const branchName = z
  .string()
  .trim()
  .max(200, "Máximo de 200 caracteres")
  .refine((value) => value === "" || isValidBranchName(value), "Nome de branch inválido");

/** Alias ou id de modelo da CLI (ex.: opus, sonnet, gpt-5.5-mini). Vazio = padrão da CLI. */
const modelName = z
  .string()
  .trim()
  .max(100, "Máximo de 100 caracteres")
  .regex(/^[\w.:/\[\]-]*$/, "Nome de modelo inválido")
  .default("");

/** Checkbox de formulário: chega como "true"/"on"/"false" no multipart e como boolean no JSON. */
const flag = z.preprocess((value) => value === true || value === "true" || value === "on", z.boolean()).default(false);

export const createTaskSchema = z
  .object({
    project: z.string().trim().min(1, "Escolha o projeto").max(100).regex(SLUG_PATTERN, "Projeto inválido"),
    title: z.string().trim().min(1, "Dê um título para a tarefa").max(200, "Máximo de 200 caracteres"),
    prompt: z.string().trim().min(1, "Descreva o que o agente deve fazer").max(50_000, "Máximo de 50 mil caracteres"),
    agent: z.enum(TASK_AGENTS).default("claude"),
    branchMode: z.enum(["new", "existing"]).default("new"),
    // new: vazio = a IA sugere o nome. existing: obrigatório.
    branch: branchName.default(""),
    // new: vazio = branch atual do repositório na máquina que executar.
    baseBranch: branchName.default(""),
    planModel: modelName,
    execModel: modelName,
    planFirst: flag,
  })
  .refine((value) => value.branchMode === "new" || value.branch !== "", {
    path: ["branch"],
    message: "Informe a branch",
  });

/** Edição mantém projeto, branch e anexos; a tarefa permanece parada até Rodar de novo. */
export const editTaskSchema = z.strictObject({
  title: createTaskSchema.shape.title,
  prompt: createTaskSchema.shape.prompt,
  agent: z.enum(TASK_AGENTS),
  planModel: modelName,
  execModel: modelName,
  planFirst: z.boolean(),
});
export type EditTaskValues = z.output<typeof editTaskSchema>;

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type CreateTaskValues = z.output<typeof createTaskSchema>;

export type AttachmentMeta = { name: string; size: number };

/** Confere quantidade e tamanho dos anexos. Retorna a mensagem de erro, ou null se estiver tudo certo. */
export function checkAttachments(files: AttachmentMeta[]): string | null {
  const { maxFiles, maxFileBytes, maxTotalBytes } = TASK_ATTACHMENT_LIMITS;
  if (files.length > maxFiles) return `Máximo de ${maxFiles} anexos por tarefa`;
  const big = files.find((file) => file.size > maxFileBytes);
  if (big) return `"${big.name}" passa de ${maxFileBytes / 1024 / 1024} MB`;
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > maxTotalBytes) return `Os anexos somam mais de ${maxTotalBytes / 1024 / 1024} MB`;
  return null;
}

/** Nome de arquivo seguro para gravar em disco e exibir: sem diretórios nem caracteres de controle. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f<>:"|?*]+/g, "_").replace(/^\.+/, "").trim().slice(0, 150);
  return clean || "anexo";
}

/** Atualização enviada pelo executor (extensão) durante e ao final da tarefa. */
export const taskProgressSchema = z.object({
  runner: z.string().trim().min(1).max(100),
  status: z.enum(["running", "done", "failed", "cancelled"]),
  resultBranch: z.string().trim().max(200).optional(),
  summary: z.string().max(20_000).optional(),
  error: z.string().max(5_000).optional(),
  logTail: z.string().max(40_000).optional(),
  committed: z.boolean().optional(),
  sessionId: z.string().trim().max(200).optional(),
  plan: z.string().max(50_000).optional(),
});

export type TaskProgress = z.infer<typeof taskProgressSchema>;

export const claimTaskSchema = z.object({
  runner: z.string().trim().min(1).max(100),
  projects: z.array(z.string().trim().regex(SLUG_PATTERN)).min(1).max(50),
});

export const taskMessageSchema = z.object({
  content: z.string().trim().min(1, "Escreva a mensagem").max(50_000, "Máximo de 50 mil caracteres"),
  // Modelo para esta continuação (vazio = o de execução da tarefa).
  model: modelName,
});

export const taskCommandSchema = z.object({
  command: z.enum(["cancel", "retry", "up", "down"]),
});

export type TaskCommand = z.infer<typeof taskCommandSchema>["command"];
