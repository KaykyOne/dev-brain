export type ParsedSkillMarkdown = { name: string | null; description: string | null };

const unquote = (value: string) => value.replace(/^(["'])(.*)\1$/, "$2").trim();

/**
 * Lê `name` e `description` do frontmatter YAML de um SKILL.md. Suporta valores simples, entre aspas
 * e em várias linhas (`>`/`|` ou continuação indentada). Sem frontmatter, o nome vem do primeiro `# Título`;
 * sem `description`, usa a primeira linha de texto do corpo (truncada), que o usuário pode ajustar.
 */
export function parseSkillMarkdown(text: string): ParsedSkillMarkdown {
  const normalized = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);

  const fields: Record<string, string> = {};
  if (match) {
    let current: string | null = null;
    for (const line of match[1].split("\n")) {
      const entry = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
      if (entry) {
        current = entry[1];
        fields[current] = /^[>|][+-]?$/.test(entry[2]) ? "" : unquote(entry[2]);
      } else if (current && /^\s+\S/.test(line)) {
        fields[current] = `${fields[current]} ${line.trim()}`.trim();
      }
    }
  }

  const body = match ? normalized.slice(match[0].length) : normalized;
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();

  let inFence = false;
  let firstLine: string | undefined;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("```")) {
      inFence = !inFence;
    } else if (!inFence && line && !line.startsWith("#")) {
      firstLine = line;
      break;
    }
  }
  const fallback = firstLine ? firstLine.slice(0, 300) : null;

  return { name: fields.name || heading || null, description: fields.description || fallback };
}
