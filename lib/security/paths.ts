/**
 * Valida um caminho relativo vindo do usuário/agente: sem raiz absoluta, sem `..`,
 * sem segmentos vazios, `.` ou barras invertidas. Retorna o caminho normalizado ou null.
 */
export function normalizeRelativePath(input: string): string | null {
  const path = input.trim().replace(/\/+$/, "");
  if (!path) return null;
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return null;

  const segments = path.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return null;

  return segments.join("/");
}

/** Garante que `path` está dentro de `root` (ambos já normalizados). */
export function isInsideRoot(root: string, path: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}
