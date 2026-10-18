import { describe, expect, it } from "vitest";

import { ACCOUNT_TARGET, agentTokenSchema } from "./agent-token";

const project = "0b3f9d3e-5a2c-4f6b-9a0e-1c2d3e4f5a6b";
const base = { name: "Agente", expiration: "90" as const };

describe("agentTokenSchema", () => {
  it("aceita token de projeto com escopos de projeto", () => {
    const result = agentTokenSchema.safeParse({
      ...base,
      projectId: project,
      scopes: ["context:read", "context:write", "changes:propose"],
    });
    expect(result.success).toBe(true);
  });

  it("aceita token de conta apenas com projects:create", () => {
    expect(agentTokenSchema.safeParse({ ...base, projectId: ACCOUNT_TARGET, scopes: ["projects:create"] }).success).toBe(
      true,
    );
  });

  it("recusa escopo de projeto em token de conta e vice-versa", () => {
    expect(agentTokenSchema.safeParse({ ...base, projectId: ACCOUNT_TARGET, scopes: ["context:write"] }).success).toBe(
      false,
    );
    expect(agentTokenSchema.safeParse({ ...base, projectId: project, scopes: ["projects:create"] }).success).toBe(false);
    expect(
      agentTokenSchema.safeParse({ ...base, projectId: ACCOUNT_TARGET, scopes: ["projects:create", "context:read"] })
        .success,
    ).toBe(false);
  });

  it("recusa alvo que não é conta nem uuid", () => {
    expect(agentTokenSchema.safeParse({ ...base, projectId: "qualquer", scopes: ["context:read"] }).success).toBe(false);
  });
});
