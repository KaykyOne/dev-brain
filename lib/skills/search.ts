/** Busca de skills: sem diferenciar maiúsculas nem acentos, com as posições para grifar o texto original. */

export type Segment = { text: string; match: boolean };

type Normalized = { text: string; origin: number[] };

/** Minúsculas e sem acentos. `origin[i]` é o índice, no texto original, do caractere que gerou `text[i]`. */
function normalize(input: string): Normalized {
  let text = "";
  const origin: number[] = [];
  let index = 0;

  for (const char of input) {
    const folded = char.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    for (const piece of folded) {
      text += piece;
      origin.push(index);
      // Cada unidade UTF-16 do caractere normalizado aponta para o mesmo caractere de origem.
      if (piece.length > 1) origin.push(index);
    }
    index += char.length;
  }

  return { text, origin };
}

const fold = (input: string) => normalize(input).text;

/** Intervalos [início, fim) do texto original em que `query` aparece. */
export function findRanges(input: string, query: string): [number, number][] {
  const needle = fold(query.trim());
  if (!needle) return [];

  const { text, origin } = normalize(input);
  const ranges: [number, number][] = [];

  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) {
    const start = origin[at];
    const last = origin[at + needle.length - 1];
    // O fim cobre o caractere de origem inteiro (que pode ter mais de uma unidade UTF-16).
    const end = last + (String.fromCodePoint(input.codePointAt(last) ?? 0).length || 1);
    ranges.push([start, end]);
  }

  return ranges;
}

export const includesText = (input: string, query: string) => findRanges(input, query).length > 0;

/** Divide o texto em trechos, marcando os que correspondem à busca (para grifar). */
export function highlightSegments(input: string, query: string): Segment[] {
  const ranges = findRanges(input, query);
  if (ranges.length === 0) return [{ text: input, match: false }];

  const segments: Segment[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) continue;
    if (start > cursor) segments.push({ text: input.slice(cursor, start), match: false });
    segments.push({ text: input.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < input.length) segments.push({ text: input.slice(cursor), match: false });
  return segments;
}

export type SkillSearchFields = { name: string; description: string; content: string | null };

export type SkillMatch = { name: boolean; description: boolean; content: boolean; project: boolean; any: boolean };

/** Onde a busca acerta em uma skill: título, descrição, conteúdo (SKILL.md) e, se houver, o nome do projeto. */
export function matchSkill(skill: SkillSearchFields, query: string, projectName?: string): SkillMatch {
  const name = includesText(skill.name, query);
  const description = includesText(skill.description, query);
  const content = skill.content ? includesText(skill.content, query) : false;
  const project = projectName ? includesText(projectName, query) : false;

  return { name, description, content, project, any: name || description || content || project };
}
