"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { CommitActivity } from "@/lib/projects/repo-info";

const MAX_SERIES = 6;

const shortDay = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

type Line = { slug: string; name: string; total: number; counts: number[]; color: string };

/** Linhas por projeto; passando de 6, o restante vira "Outros" (nunca se geram cores novas). */
function buildLines(activity: CommitActivity): Line[] {
  const visible = activity.series.filter((item) => item.total > 0);
  const lines = visible.slice(0, MAX_SERIES).map((item, index) => ({ ...item, color: `var(--series-${index + 1})` }));
  const rest = visible.slice(MAX_SERIES);
  if (rest.length) {
    lines.push({
      slug: "_others",
      name: `Outros (${rest.length})`,
      total: rest.reduce((sum, item) => sum + item.total, 0),
      counts: activity.days.map((_, day) => rest.reduce((sum, item) => sum + item.counts[day], 0)),
      color: "var(--series-other)",
    });
  }
  return lines;
}

type TooltipProps = {
  active?: boolean;
  label?: string;
  payload?: { dataKey: string; value: number; color: string }[];
  names: Map<string, string>;
};

function ChartTooltip({ active, label, payload, names }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{label ? shortDay(label) : ""}</p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">Sem commits</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((item) => (
            <li key={item.dataKey} className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
              <span className="flex-1">{names.get(item.dataKey)}</span>
              <span className="tabular-nums">{item.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Commits por dia: uma linha por projeto (série temporal), com tooltip, legenda com totais e tabela para leitores de tela. */
export function CommitChart({ activity }: { activity: CommitActivity }) {
  const lines = buildLines(activity);
  const total = lines.reduce((sum, line) => sum + line.total, 0);

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum commit nos últimos {activity.days.length} dias.</p>;
  }

  const data = activity.days.map((day, index) => ({
    day,
    ...Object.fromEntries(lines.map((line) => [line.slug, line.counts[index]])),
  }));
  const names = new Map(lines.map((line) => [line.slug, line.name]));

  return (
    <div className="space-y-4">
      <div className="h-64 w-full" role="img" aria-label={`Commits por dia nos últimos ${activity.days.length} dias: ${total} no total`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="day"
              tickFormatter={shortDay}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip content={<ChartTooltip names={names} />} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} />
            {lines.map((line) => (
              <Line
                key={line.slug}
                type="monotone"
                dataKey={line.slug}
                stroke={line.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {lines.map((line) => (
          <li key={line.slug} className="flex items-center gap-2">
            <span className="h-0.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: line.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{line.name}</span>
            <span className="tabular-nums text-muted-foreground">{line.total}</span>
          </li>
        ))}
      </ul>

      <table className="sr-only">
        <caption>Commits por dia e por projeto</caption>
        <thead>
          <tr>
            <th>Dia</th>
            {lines.map((line) => (
              <th key={line.slug}>{line.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activity.days.map((day, index) => (
            <tr key={day}>
              <td>{shortDay(day)}</td>
              {lines.map((line) => (
                <td key={line.slug}>{line.counts[index]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
