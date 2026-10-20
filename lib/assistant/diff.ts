import type { Change } from "./protocol";

const clip = (text: string, max = 90) => {
  const single = text.replace(/\s+/g, " ").trim();
  return single.length > max ? `${single.slice(0, max - 1)}…` : single;
};

const lines = (text: string) => (text === "" ? [] : text.split("\n"));
const lineCount = (text: string) => lines(text).length;

/** Linhas que existem só de um dos lados (multiconjunto), uma estimativa honesta do que mudou em um texto. */
export function lineDelta(before: string, after: string) {
  const counts = new Map<string, number>();
  for (const line of lines(before)) counts.set(line, (counts.get(line) ?? 0) + 1);

  let added = 0;
  for (const line of lines(after)) {
    const left = counts.get(line) ?? 0;
    if (left > 0) counts.set(line, left - 1);
    else added += 1;
  }
  const removed = [...counts.values()].reduce((sum, value) => sum + value, 0);
  return { added, removed };
}

/** Mudança de um campo curto (nome, descrição...), só quando o valor realmente mudou. */
export function textChange(field: string, before: string, after: string | undefined): Change[] {
  if (after === undefined || after === before) return [];
  return [{ field, before: clip(before), after: clip(after) }];
}

/** Mudança de um texto longo (SKILL.md, arquivo): resume em linhas em vez de despejar o conteúdo. */
export function contentChange(field: string, before: string, after: string | undefined): Change[] {
  if (after === undefined || after === before) return [];

  const { added, removed } = lineDelta(before, after);
  const parts = [added > 0 && `+${added}`, removed > 0 && `−${removed}`].filter(Boolean).join(" ");
  return [
    {
      field,
      before: before ? `${lineCount(before)} linhas` : "vazio",
      after: `${lineCount(after)} linhas${parts ? ` (${parts})` : ""}`,
    },
  ];
}
