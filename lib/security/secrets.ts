const PATTERNS: [name: string, pattern: RegExp][] = [
  ["chave privada", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["token GitHub", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["token GitHub (fine-grained)", /\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ["chave AWS", /\bAKIA[0-9A-Z]{16}\b/],
  ["chave de API (sk-)", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["token Slack", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ["token DevBrain", /\bdvb_[A-Za-z0-9_-]{40,}\b/],
  ["credencial em URL", /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@[^\s/]+/i],
];

/** Retorna os tipos de segredo encontrados no texto (vazio se nenhum). */
export function findSecrets(text: string): string[] {
  return PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}
