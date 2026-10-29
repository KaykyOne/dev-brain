import { mkdtemp, readFile, rm, symlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  archiveRepo,
  initRepo,
  isRepo,
  listFiles,
  readRepoFile,
  repoCommitDates,
  repoDir,
  repoHistory,
  repoLog,
  writeRepoFile,
} from "./repo";

const templateDir = join(process.cwd(), "templates", "context");
const vars = { name: "Projeto Teste", slug: "projeto-teste", description: "Um projeto de teste" };

let root: string;
let dir: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "context-repos-"));
  await initRepo({ root, templateDir, vars, branch: "main" });
  dir = repoDir(root, vars.slug);
});

afterAll(() => rm(root, { recursive: true, force: true }));

describe("initRepo", () => {
  it("cria o repositório com o commit inicial e o padrão do context", async () => {
    expect(await isRepo(dir)).toBe(true);

    const files = await listFiles(dir);
    expect(files).toEqual(
      expect.arrayContaining([
        "README.md",
        "00-base.md",
        "skills/proibido-push.md",
        "skills/commit-do-context.md",
        "tasks/_modelo.md",
        "raiz/AGENTS.md",
        "raiz/.claude/settings.json",
      ]),
    );

    const log = await repoLog(dir);
    expect(log).toHaveLength(1);
    expect(log[0].subject).toBe("feat: estrutura inicial do context");
  });

  it("substitui os placeholders", async () => {
    const readme = await readFile(join(dir, "README.md"), "utf8");
    expect(readme).toContain("Projeto Teste");
    expect(readme).not.toContain("{{");
    expect(await readFile(join(dir, "00-base.md"), "utf8")).toContain("Um projeto de teste");
  });

  it("gera o raiz/AGENTS.md que obriga o uso do MCP do projeto", async () => {
    const agents = await readFile(join(dir, "raiz/AGENTS.md"), "utf8");
    expect(agents).toContain("OBRIGATÓRIO");
    expect(agents).toContain('project: "projeto-teste"');
    expect(agents).toContain("Projeto Teste");
    expect(agents).not.toContain("{{");
  });

  it("adota um repositório existente sem recriar", async () => {
    const result = await initRepo({ root, templateDir, vars, branch: "main" });
    expect(result.created).toBe(false);
    expect(await repoLog(dir)).toHaveLength(1);
  });

  it("recusa slug que escapa da pasta raiz", () => {
    expect(() => repoDir(root, "../fora")).toThrow();
    expect(() => repoDir(root, "A/B")).toThrow();
  });
});

describe("writeRepoFile", () => {
  it("grava e commita só o arquivo, com o autor informado", async () => {
    const result = await writeRepoFile(dir, "notas/2026-01-01-teste.md", "# Nota\n", {
      message: "docs: registrar nota de teste",
      author: "Claude Code",
    });
    expect(result).toMatchObject({ changed: true, created: true });

    const [latest] = await repoLog(dir, 1);
    expect(latest).toMatchObject({ subject: "docs: registrar nota de teste", author: "Claude Code" });
    expect((await readRepoFile(dir, "notas/2026-01-01-teste.md")).content).toBe("# Nota\n");
  });

  it("não cria commit quando o conteúdo é idêntico", async () => {
    const before = (await repoLog(dir)).length;
    const result = await writeRepoFile(dir, "notas/2026-01-01-teste.md", "# Nota\n", { message: "docs: igual" });
    expect(result.changed).toBe(false);
    expect(await repoLog(dir)).toHaveLength(before);
  });

  it("não leva arquivos alheios para o commit", async () => {
    await writeRepoFile(dir, "notas/a.md", "a", { message: "docs: a" });
    await writeRepoFile(dir, "notas/b.md", "b", { message: "docs: b" });
    const [latest, previous] = await repoLog(dir, 2);
    expect([latest.subject, previous.subject]).toEqual(["docs: b", "docs: a"]);
  });

  it.each(["../fora.md", "/etc/passwd.md", ".git/config.md", "notas/../../x.md", "a\\b.md", ""])(
    "recusa caminho inseguro %j",
    async (path) => {
      await expect(writeRepoFile(dir, path, "x", { message: "docs: x" })).rejects.toThrow();
    },
  );

  it("recusa extensão não permitida e mensagem inválida", async () => {
    await expect(writeRepoFile(dir, "run.sh", "x", { message: "docs: x" })).rejects.toThrow(/Extensão/);
    await expect(writeRepoFile(dir, "notas/c.md", "x", { message: "a\nb" })).rejects.toThrow(/Mensagem/);
    await expect(writeRepoFile(dir, "notas/c.md", "x", { message: " " })).rejects.toThrow(/Mensagem/);
  });

  it("recusa escrever através de symlink que sai do repositório", async () => {
    const outside = await mkdtemp(join(tmpdir(), "outside-"));
    await symlink(outside, join(dir, "escape"));
    await expect(writeRepoFile(dir, "escape/x.md", "x", { message: "docs: x" })).rejects.toThrow(/fora/);
    await rm(outside, { recursive: true, force: true });
  });

  it("serializa commits simultâneos", async () => {
    await mkdir(join(dir, "notas"), { recursive: true });
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        writeRepoFile(dir, `notas/par-${index}.md`, String(index), { message: `docs: par ${index}` }),
      ),
    );
    expect(results.every((result) => result.changed)).toBe(true);
  });
});

describe("readRepoFile", () => {
  it("recusa a pasta .git e arquivos inexistentes", async () => {
    await expect(readRepoFile(dir, ".git/HEAD")).rejects.toThrow();
    await expect(readRepoFile(dir, "nao-existe.md")).rejects.toThrow(/não encontrado/);
  });
});

describe("archiveRepo", () => {
  it("move para .trash sem apagar o histórico", async () => {
    await initRepo({ root, templateDir, vars: { ...vars, slug: "descartavel" }, branch: "main" });
    const target = await archiveRepo(root, "descartavel");

    expect(target).toContain(".trash");
    expect(await isRepo(repoDir(root, "descartavel"))).toBe(false);
    expect(await isRepo(target!)).toBe(true);
    expect(await archiveRepo(root, "descartavel")).toBeNull();
  });
});

describe("histórico e atividade", () => {
  it("repoHistory devolve mais que o limite do MCP e repoCommitDates conta os commits recentes", async () => {
    const history = await repoHistory(dir, 300);
    expect(history.length).toBe((await repoLog(dir, 100)).length);
    expect(await repoCommitDates(dir, 30)).toHaveLength(history.length);
  });
});
