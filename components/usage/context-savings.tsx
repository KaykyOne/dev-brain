import { GaugeIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent, formatTokens } from "@/lib/format";
import { CHARS_PER_TOKEN, getUsageSummary, SESSION_GAP_MS } from "@/lib/usage";

const DAYS = 30;

type ContextSavingsProps = {
  ownerId: string;
  /** Restringe a um projeto (página do projeto). Sem ele, mostra a conta e o detalhe por projeto. */
  projectId?: string;
  /** Nomes para o detalhe por projeto (dashboard). */
  projects?: { id: string; name: string; slug: string }[];
};

/** Tokens entregues pelo MCP e a economia estimada do contexto fatiado, nos últimos 30 dias. */
export async function ContextSavings({ ownerId, projectId, projects = [] }: ContextSavingsProps) {
  const { overall, byProject } = await getUsageSummary(ownerId, { days: DAYS, projectId });

  const tiles = [
    {
      label: "Economia estimada",
      value: formatTokens(overall.savedTokens),
      hint: overall.savedRatio === null ? "sem sessões" : `${formatPercent(overall.savedRatio)} do contexto inteiro`,
    },
    { label: "Entregues pelo MCP", value: formatTokens(overall.deliveredTokens), hint: `${overall.calls} chamadas` },
    { label: "Contexto inteiro equivalente", value: formatTokens(overall.fullContextTokens), hint: "carregado a cada sessão" },
    { label: "Sessões", value: String(overall.sessions), hint: `pausa de ${SESSION_GAP_MS / 60_000} min encerra` },
  ];

  const rows = projects
    .map((project) => ({ project, totals: byProject.get(project.id) }))
    .filter((row): row is { project: (typeof projects)[number]; totals: NonNullable<typeof row.totals> } => !!row.totals)
    .sort((a, b) => b.totals.savedTokens - a.totals.savedTokens);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Economia de contexto</CardTitle>
        <CardDescription>
          Tokens estimados nos últimos {DAYS} dias: o que o MCP entregou ao agente comparado a carregar o contexto
          inteiro (repositório e skills) em toda sessão.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {overall.calls === 0 ? (
          <EmptyState
            icon={GaugeIcon}
            title="Nenhuma chamada ao MCP ainda"
            description="Os números aparecem quando um agente usar o contexto pelo MCP."
          />
        ) : (
          <>
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {tiles.map((tile) => (
                <div key={tile.label} className="rounded-lg border p-4">
                  <dt className="text-xs text-muted-foreground">{tile.label}</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums">{tile.value}</dd>
                  <dd className="text-xs text-muted-foreground">{tile.hint}</dd>
                </div>
              ))}
            </dl>

            {rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Projeto</th>
                      <th className="py-2 pr-4 text-right font-medium">Sessões</th>
                      <th className="py-2 pr-4 text-right font-medium">Entregues</th>
                      <th className="py-2 pr-4 text-right font-medium">Contexto inteiro</th>
                      <th className="py-2 text-right font-medium">Economia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map(({ project, totals }) => (
                      <tr key={project.id}>
                        <td className="py-2 pr-4">
                          <Link href={`/projects/${project.slug}`} className="hover:underline">
                            {project.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">{totals.sessions}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{formatTokens(totals.deliveredTokens)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{formatTokens(totals.fullContextTokens)}</td>
                        <td className="py-2 text-right tabular-nums">
                          {formatTokens(totals.savedTokens)}
                          {totals.savedRatio !== null && (
                            <span className="text-muted-foreground"> ({formatPercent(totals.savedRatio)})</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Estimativa: cerca de {CHARS_PER_TOKEN} caracteres por token, e sessão é uma sequência de chamadas da mesma
          chave ao mesmo projeto. Não inclui o que o agente gasta lendo código; o tamanho do contexto inteiro é o atual.
        </p>
      </CardContent>
    </Card>
  );
}

export function ContextSavingsFallback() {
  return <Skeleton className="h-64 w-full rounded-xl" />;
}
