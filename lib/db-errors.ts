const UNIQUE_VIOLATION = "23505";

/** Drizzle encapsula o erro do driver em `cause`. */
export function isUniqueViolation(error: unknown): boolean {
  const code = (error as { cause?: { code?: string }; code?: string } | null);
  return code?.cause?.code === UNIQUE_VIOLATION || code?.code === UNIQUE_VIOLATION;
}
