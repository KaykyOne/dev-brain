export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export const fail = (error: string, fieldErrors?: Record<string, string[] | undefined>) =>
  ({ ok: false, error, fieldErrors }) as const;
