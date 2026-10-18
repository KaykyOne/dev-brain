import { findSecrets } from "@/lib/security/secrets";

/** Conteúdo vazio vira null (skill sem SKILL.md). */
export const normalizeSkillContent = (content: string) => (content.trim() ? content : null);

/** Valida o SKILL.md importado: recusa conteúdo com segredos; devolve o texto pronto para gravar. */
export function checkSkillContent(content: string): { ok: true; content: string | null } | { ok: false; message: string } {
  const secrets = findSecrets(content);
  if (secrets.length > 0) return { ok: false, message: `parece conter segredos (${secrets.join(", ")})` };
  return { ok: true, content: normalizeSkillContent(content) };
}
