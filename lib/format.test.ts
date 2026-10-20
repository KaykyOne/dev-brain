import { describe, expect, it } from "vitest";

import { dayKey, formatRelative } from "./format";

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
