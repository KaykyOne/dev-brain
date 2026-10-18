import { highlightSegments } from "@/lib/skills/search";

export const MARK_CLASS = "rounded-sm bg-yellow-200 px-0.5 text-yellow-950 dark:bg-yellow-400/40 dark:text-yellow-50";

/** Mostra o texto grifando em amarelo os trechos que correspondem à busca (sem diferenciar acentos). */
export function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query?.trim()) return <>{text}</>;

  return (
    <>
      {highlightSegments(text, query).map((segment, index) =>
        segment.match ? (
          <mark key={index} className={MARK_CLASS}>
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
