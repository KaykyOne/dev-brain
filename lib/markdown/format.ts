/** Formatações do editor Markdown, como funções puras sobre o texto e a seleção (testáveis sem o editor). */

export type FormatAction = "bold" | "italic" | "code" | "codeblock" | "link" | "heading" | "ul" | "ol" | "quote";

export type Edit = { from: number; to: number; insert: string; anchor: number; head: number };

function wrap(doc: string, from: number, to: number, before: string, after: string, placeholder: string): Edit {
  const selected = doc.slice(from, to);
  const inner = selected || placeholder;
  const insert = `${before}${inner}${after}`;
  const start = from + before.length;
  return { from, to, insert, anchor: start, head: start + inner.length };
}

/** Aplica um prefixo em cada linha tocada pela seleção (ou remove, se todas já o tiverem). */
function prefixLines(doc: string, from: number, to: number, prefix: (index: number) => string): Edit {
  const lineStart = doc.lastIndexOf("\n", from - 1) + 1;
  const nextBreak = doc.indexOf("\n", to);
  const lineEnd = nextBreak === -1 ? doc.length : nextBreak;
  const lines = doc.slice(lineStart, lineEnd).split("\n");

  const pattern = /^(#{1,6} |- |\d+\. |> )/;
  const allPrefixed = lines.every((line, i) => line.startsWith(prefix(i)));
  const next = lines.map((line, i) => (allPrefixed ? line.slice(prefix(i).length) : `${prefix(i)}${line.replace(pattern, "")}`));
  const insert = next.join("\n");

  return { from: lineStart, to: lineEnd, insert, anchor: lineStart, head: lineStart + insert.length };
}

export function formatSelection(doc: string, from: number, to: number, action: FormatAction): Edit {
  switch (action) {
    case "bold":
      return wrap(doc, from, to, "**", "**", "negrito");
    case "italic":
      return wrap(doc, from, to, "_", "_", "itálico");
    case "code":
      return wrap(doc, from, to, "`", "`", "código");
    case "codeblock":
      return wrap(doc, from, to, "```\n", "\n```", "código");
    case "link": {
      const label = doc.slice(from, to) || "texto";
      const insert = `[${label}](https://)`;
      const urlStart = from + label.length + 3;
      return { from, to, insert, anchor: urlStart, head: urlStart + "https://".length };
    }
    case "heading":
      return prefixLines(doc, from, to, () => "## ");
    case "ul":
      return prefixLines(doc, from, to, () => "- ");
    case "ol":
      return prefixLines(doc, from, to, (i) => `${i + 1}. `);
    case "quote":
      return prefixLines(doc, from, to, () => "> ");
  }
}
