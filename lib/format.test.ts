import { describe, expect, it } from "vitest";

import { dayKey, formatPercent, formatRelative, formatTokens } from "./format";

describe("formatRelative", () => {
  const now = new Date("2026-10-20T15:00:00Z");

  it("descreve o intervalo em pt-BR", () => {
    expect(formatRelative("2026-10-20T12:00:00Z", now)).toBe("há 3 horas");
    expect(formatRelative("2026-10-19T14:00:00Z", now)).toBe("ontem");
    expect(formatRelative("2026-10-20T14:59:50Z", now)).toBe("agora");
  });
});

describe("dayKey", () => {
  it("usa o dia civil de São Paulo", () => {
    expect(dayKey("2026-10-20T02:00:00Z")).toBe("2026-10-19");
    expect(dayKey("2026-10-20T12:00:00Z")).toBe("2026-10-20");
  });
});

describe("formatTokens e formatPercent", () => {
  it("resume números grandes e porcentagens em pt-BR", () => {
    expect(formatTokens(850)).toBe("850");
    expect(formatTokens(12_340).replace(/\s/g, " ")).toBe("12,3 mil");
    expect(formatPercent(0.834)).toBe("83%");
  });
});
