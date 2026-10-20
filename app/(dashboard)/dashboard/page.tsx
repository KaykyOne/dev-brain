import { ActivityIcon, FileTextIcon, FolderGitIcon, GitCommitHorizontalIcon, GitPullRequestIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CommitChart } from "@/components/shared/commit-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTIVITY_LABELS, type ActivityAction } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth/dal";
import { getDashboardData } from "@/lib/dashboard";
import { formatDateTime, shortSha } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  // Ler a sessão primeiro torna a página dinâmica antes de qualquer valor dependente do tempo.
  const user = await getCurrentUser();
  const data = await getDashboardData(user.id);

  const stats = [
    { label: "Projetos", value: data.projects, icon: FolderGitIcon },
    { label: "Arquivos de contexto", value: data.contexts, icon: FileTextIcon },
    { label: "Skills", value: data.skills, icon: SparklesIcon },
    { label: "Alterações pendentes", value: data.pendingChanges, icon: GitPullRequestIcon },
  ];

  return (
    <>
      <PageHeader title={<>Olá, {user.name.split(" ")[0]}</>} description={<>Hub de repositórios de contexto dos seus projetos.</>} />

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

      <Card>
        <CardHeader>
          <CardTitle>Commits por projeto</CardTitle>
          <CardDescription>Últimos {data.commitActivity.days.length} dias, por dia e por projeto.</CardDescription>
        </CardHeader>
        <CardContent>
          <CommitChart activity={data.commitActivity} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Últimos commits</CardTitle>
            <CardDescription>Histórico dos repositórios de contexto.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentCommits.length === 0 ? (
              <EmptyState icon={GitCommitHorizontalIcon} title="Nenhum commit ainda" />
            ) : (
              <ul className="divide-y">
                {data.recentCommits.map((commit) => (
                  <li key={`${commit.project.slug}-${commit.sha}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">{commit.subject}</span>
                      <Link href={`/projects/${commit.project.slug}`} className="text-xs text-muted-foreground hover:underline">
                        {commit.project.name} · {shortSha(commit.sha)}
                      </Link>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(commit.date)}</span>
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
