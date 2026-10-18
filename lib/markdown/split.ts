/** Separa o frontmatter YAML (entre `---`) do corpo de um Markdown, como em um SKILL.md. */
export function splitFrontmatter(text: string): { frontmatter: string | null; body: string } {
  const normalized = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return { frontmatter: null, body: normalized };

  return { frontmatter: match[1], body: normalized.slice(match[0].length) };
}
