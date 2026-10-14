import { ActivityIcon, FileTextIcon, FolderGitIcon, GitPullRequestIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTIVITY_LABELS, type ActivityAction } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth/dal";
import { getDashboardData } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  // Ler a sessão primeiro torna a página dinâmica antes de qualquer valor dependente do tempo.
  const user = await getCurrentUser();
  const data = await getDashboardData(user.id);

  const stats = [
    { label: "Projetos", value: data.projects, icon: FolderGitIcon },
    { label: "Contextos", value: data.contexts, icon: FileTextIcon },
    { label: "Skills", value: data.skills, icon: SparklesIcon },
    { label: "Alterações pendentes", value: data.pendingChanges, icon: GitPullRequestIcon },
  ];

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {user.name.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Visão geral dos contextos dos seus agentes.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <Icon className="size-4" /> {label}
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Últimas sincronizações</CardTitle>
            <CardDescription>Resultado das sincronizações com o GitHub.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentSyncs.length === 0 ? (
              <EmptyState icon={GitPullRequestIcon} title="Nenhuma sincronização ainda" />
            ) : (
              <ul className="divide-y">
                {data.recentSyncs.map((sync) => (
                  <li key={sync.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link href={`/projects/${sync.projectSlug}`} className="truncate font-medium hover:underline">
                      {sync.projectName}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant={sync.status === "success" ? "secondary" : "destructive"}>
                        {sync.status === "success" ? "Sucesso" : "Falha"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(sync.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atividade recente</CardTitle>
            <CardDescription>Ações realizadas no DevBrain.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <EmptyState icon={ActivityIcon} title="Nenhuma atividade ainda" />
            ) : (
              <ul className="divide-y">
                {data.recentActivity.map((entry) => {
                  const name = typeof entry.metadata.name === "string" ? entry.metadata.name : null;
                  return (
                    <li key={entry.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="truncate">
                        {ACTIVITY_LABELS[entry.action as ActivityAction] ?? entry.action}
                        {name && <span className="text-muted-foreground"> · {name}</span>}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
