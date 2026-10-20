import type { CommitActivity } from "@/lib/projects/repo-info";

/** Cores distintas nos dois temas; a ordem segue o total de commits (a maior série primeiro). */
export const SERIES_COLORS = [
  "oklch(0.62 0.19 259)",
  "oklch(0.7 0.17 150)",
  "oklch(0.75 0.16 70)",
  "oklch(0.64 0.21 25)",
  "oklch(0.62 0.2 305)",
  "oklch(0.7 0.12 200)",
];
const OTHERS_COLOR = "oklch(0.6 0 0)";
const MAX_SERIES = SERIES_COLORS.length;

const shortDay = (key: string) => key.slice(8, 10) + "/" + key.slice(5, 7);

/** Commits por dia, empilhados por projeto. Sem biblioteca: colunas em CSS, com legenda e totais. */
export function CommitChart({ activity }: { activity: CommitActivity }) {
  const visible = activity.series.filter((item) => item.total > 0);
  const top = visible.slice(0, MAX_SERIES);
  const rest = visible.slice(MAX_SERIES);
  const groups = [
    ...top.map((item, index) => ({ ...item, color: SERIES_COLORS[index] })),
    ...(rest.length
      ? [
          {
            slug: "_others",
            name: `Outros (${rest.length})`,
            total: rest.reduce((sum, item) => sum + item.total, 0),
            counts: activity.days.map((_, day) => rest.reduce((sum, item) => sum + item.counts[day], 0)),
            color: OTHERS_COLOR,
          },
        ]
      : []),
  ];

  const totals = activity.days.map((_, day) => groups.reduce((sum, item) => sum + item.counts[day], 0));
  const max = Math.max(1, ...totals);
  const total = totals.reduce((sum, value) => sum + value, 0);

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum commit nos últimos {activity.days.length} dias.</p>;
  }

  return (
    <div className="space-y-4">
      <div
        role="img"
        aria-label={`Commits por dia nos últimos ${activity.days.length} dias: ${total} no total`}
        className="flex h-40 items-end gap-[3px] border-b"
      >
        {activity.days.map((day, index) => (
          <div
            key={day}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
            title={`${shortDay(day)}: ${totals[index]} commit${totals[index] === 1 ? "" : "s"}${groups
              .filter((item) => item.counts[index] > 0)
              .map((item) => `\n${item.name}: ${item.counts[index]}`)
              .join("")}`}
          >
            {groups.map((item) =>
              item.counts[index] > 0 ? (
                <div
                  key={item.slug}
                  className="w-full first:rounded-t-[3px]"
                  style={{ height: `${(item.counts[index] / max) * 100}%`, backgroundColor: item.color }}
                />
              ) : null,
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{shortDay(activity.days[0])}</span>
        <span>{shortDay(activity.days[activity.days.length - 1])}</span>
      </div>
      <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {groups.map((item) => (
          <li key={item.slug} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            <span className="tabular-nums text-muted-foreground">{item.total}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
