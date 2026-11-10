import { describe, expect, it } from "vitest";

import {
  checkAttachments,
  createTaskSchema,
  editTaskSchema,
  isValidBranchName,
  sanitizeFileName,
  TASK_ATTACHMENT_LIMITS,
  taskMessageSchema,
} from "./task";

const base = { project: "loja", title: "Paginar pedidos", prompt: "Adicionar paginação" };

describe("createTaskSchema", () => {
  it("aplica os padrões: Claude, branch nova com nome escolhido pela IA", () => {
    const parsed = createTaskSchema.parse(base);
    expect(parsed).toMatchObject({ agent: "claude", branchMode: "new", branch: "", baseBranch: "" });
  });

  it("exige a branch quando o modo é existente", () => {
    const result = createTaskSchema.safeParse({ ...base, branchMode: "existing" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["branch"]);
  });

  it("aceita branch existente informada", () => {
    expect(createTaskSchema.parse({ ...base, branchMode: "existing", branch: "feat/x" }).branch).toBe("feat/x");
  });

  it("recusa título e instruções vazios e branch inválida", () => {
    expect(createTaskSchema.safeParse({ ...base, title: "  " }).success).toBe(false);
    expect(createTaskSchema.safeParse({ ...base, prompt: "" }).success).toBe(false);
    expect(createTaskSchema.safeParse({ ...base, branch: "feat/../x" }).success).toBe(false);
    expect(createTaskSchema.safeParse({ ...base, project: "Loja Grande" }).success).toBe(false);
  });
});

describe("modelos e planejamento", () => {
  it("aceita aliases e ids de modelo, e o checkbox do multipart", () => {
    const parsed = createTaskSchema.parse({ ...base, planModel: "opus", execModel: "claude-haiku-5-5", planFirst: "true" });
    expect(parsed).toMatchObject({ planModel: "opus", execModel: "claude-haiku-5-5", planFirst: true });
    expect(createTaskSchema.parse({ ...base, planFirst: "false" }).planFirst).toBe(false);
    expect(createTaskSchema.parse(base)).toMatchObject({ planModel: "", execModel: "", planFirst: false });
  });

  it("recusa nome de modelo com espaços ou aspas", () => {
    expect(createTaskSchema.safeParse({ ...base, execModel: "opus; rm -rf" }).success).toBe(false);
    expect(createTaskSchema.safeParse({ ...base, planModel: '"x"' }).success).toBe(false);
  });
});

describe("taskMessageSchema", () => {
  it("exige conteúdo", () => {
    expect(taskMessageSchema.safeParse({ content: "  " }).success).toBe(false);
    expect(taskMessageSchema.parse({ content: "agora adicione testes" })).toMatchObject({ content: "agora adicione testes", model: "" });
  });
});

describe("isValidBranchName", () => {
  it.each(["main", "feat/paginacao", "fix/bug-12", "release/1.2.0"])("aceita %s", (name) => {
    expect(isValidBranchName(name)).toBe(true);
  });
  it.each(["feat x", "/feat", "feat/", "a..b", "a//b", "-x", "x.lock", "x~1"])("recusa %s", (name) => {
    expect(isValidBranchName(name)).toBe(false);
  });
});

describe("checkAttachments", () => {
  const mb = 1024 * 1024;
  it("aceita poucos arquivos pequenos", () => {
    expect(checkAttachments([{ name: "a.png", size: mb }])).toBeNull();
  });
  it("recusa arquivos demais, arquivo grande e total grande", () => {
    const many = Array.from({ length: TASK_ATTACHMENT_LIMITS.maxFiles + 1 }, (_, i) => ({ name: `${i}`, size: 1 }));
    expect(checkAttachments(many)).toMatch(/Máximo/);
    expect(checkAttachments([{ name: "big.zip", size: TASK_ATTACHMENT_LIMITS.maxFileBytes + 1 }])).toMatch(/big\.zip/);
    expect(checkAttachments([1, 2, 3].map((i) => ({ name: `${i}`, size: 9 * mb })))).toMatch(/somam/);
  });
});

describe("sanitizeFileName", () => {
  it("remove diretórios e caracteres perigosos", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\x\\print.png")).toBe("print.png");
    expect(sanitizeFileName('a<b>:"c".txt')).toBe("a_b_c_.txt");
    expect(sanitizeFileName(".env")).toBe("env");
    expect(sanitizeFileName("")).toBe("anexo");
  });
});


describe("editTaskSchema", () => {
  const edits = { title: "Corrigida", prompt: "Novas instruções", agent: "codex", planModel: "planner", execModel: "worker", planFirst: true };
  it("aceita correções sem exigir projeto ou branch", () => {
    expect(editTaskSchema.parse(edits)).toEqual(edits);
  });
  it("não permite alterar status, projeto, sessão ou anexos por esta rota", () => {
    for (const field of ["status", "project", "sessionId", "attachments", "branch"]) {
      expect(editTaskSchema.safeParse({ ...edits, [field]: "indevido" }).success).toBe(false);
    }
  });
  it("valida conteúdo e modelos na edição", () => {
    for (const changed of [{ title: " " }, { prompt: " " }, { execModel: "worker; x" }, { agent: "outro" }]) {
      expect(editTaskSchema.safeParse({ ...edits, ...changed }).success).toBe(false);
    }
  });
});
