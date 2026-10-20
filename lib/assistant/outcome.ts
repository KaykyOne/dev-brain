import type { Change, ResultLink } from "./protocol";

/** Resultado de uma ação executada pelo assistente. */
export type Outcome =
  | { ok: true; summary: string; data?: unknown; changes?: Change[]; links?: ResultLink[]; mutated?: boolean }
  | { ok: false; error: string };
