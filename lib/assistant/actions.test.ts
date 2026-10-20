import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ACTIONS, enabledActions, getAction, toolDefinitions } from "./actions";
import { ARG_SCHEMAS } from "./schemas";

const handlersSource = readFileSync(join(process.cwd(), "lib/assistant/handlers.ts"), "utf8");

type JsonSchema = { properties?: Record<string, { type?: string; enum?: string[]; items?: { type?: string } }>; required?: string[] };

describe("actions.json × código", () => {
  it("toda ação tem esquema de argumentos e handler, e vice-versa", () => {
    const names = ACTIONS.map((action) => action.name).sort();
    expect(Object.keys(ARG_SCHEMAS).sort()).toEqual(names);

    const handlerNames = [...handlersSource.matchAll(/^  ([a-z_]+): handler\(\{/gm)].map((match) => match[1]).sort();
    expect(handlerNames).toEqual(names);
  });

  it.each(ACTIONS.map((action) => action.name))("%s: parâmetros do JSON batem com o esquema de validação", (name) => {
    const action = getAction(name)!;
    const schema = ARG_SCHEMAS[name as keyof typeof ARG_SCHEMAS];
    const fromCode = z.toJSONSchema(schema, { io: "input" }) as JsonSchema;

    expect(Object.keys(action.parameters.properties).sort()).toEqual(Object.keys(fromCode.properties ?? {}).sort());
    expect([...(action.parameters.required ?? [])].sort()).toEqual([...(fromCode.required ?? [])].sort());

    for (const [key, spec] of Object.entries(action.parameters.properties) as [string, { type?: string; enum?: string[] }][]) {
      const code = fromCode.properties![key];
      expect(spec.type, `${name}.${key} tipo`).toBe(code.type);
      expect(spec.enum, `${name}.${key} enum`).toEqual(code.enum);
    }
  });

  it.each(ACTIONS.map((action) => action.name))("%s: o exemplo é aceito pela validação", (name) => {
    const action = getAction(name)!;
    const result = ARG_SCHEMAS[name as keyof typeof ARG_SCHEMAS].safeParse(action.example);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it("rejeita argumentos desconhecidos (esquemas estritos)", () => {
    expect(ARG_SCHEMAS.get_project.safeParse({ slug: "a", extra: 1 }).success).toBe(false);
  });
});

describe("política de segurança", () => {
  it("toda ação de remoção exige confirmação do usuário", () => {
    for (const action of ACTIONS.filter((item) => item.name.startsWith("delete_"))) {
      expect(action.confirm, action.name).toBe(true);
    }
  });

  it("ações de leitura nunca marcam mutates nem confirm", () => {
    for (const action of ACTIONS.filter((item) => /^(list|get|read)_/.test(item.name))) {
      expect(action.mutates, action.name).toBe(false);
      expect(action.confirm, action.name).toBe(false);
    }
  });
});

describe("toolDefinitions", () => {
  it("expõe ao modelo só as ações liberadas, no formato da API", () => {
    const tools = toolDefinitions();
    expect(tools).toHaveLength(enabledActions().length);
    for (const tool of tools) {
      expect(tool.type).toBe("function");
      expect(tool.function.parameters.type).toBe("object");
      expect(tool.function.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    }
  });
});
