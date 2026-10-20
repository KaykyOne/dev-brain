"use client";

import { CheckIcon, CopyIcon, GitCommitHorizontalIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dayKey, formatDateTime, formatLongDay, formatRelative, shortSha } from "@/lib/format";

type Commit = { sha: string; author: string; date: string; subject: string };

const PAGE = 30;

function ShaButton({ sha }: { sha: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(sha);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copiar o hash completo"
      className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 font-mono text-xs hover:bg-muted"
    >
      {shortSha(sha)}
      {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3 text-muted-foreground" />}
    </button>
  );
}

/** Listagem de commits no estilo do GitHub: agrupada por dia, com busca e "mostrar mais". */
export function CommitList({ commits, branch }: { commits: Commit[]; branch: string }) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return commits;
    return commits.filter(
      (commit) =>
        commit.subject.toLowerCase().includes(term) ||
        commit.author.toLowerCase().includes(term) ||
        commit.sha.startsWith(term),
    );
  }, [commits, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Commit[]>();
    for (const commit of filtered.slice(0, shown)) {
      const key = dayKey(commit.date);
      map.set(key, [...(map.get(key) ?? []), commit]);
    }
    return [...map.entries()];
  }, [filtered, shown]);

  if (commits.length === 0) {
    return <EmptyState icon={GitCommitHorizontalIcon} title="Nenhum commit ainda" description="O histórico aparece aqui assim que o repositório receber commits." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShown(PAGE);
            }}
            placeholder="Buscar por mensagem, autor ou hash"
            className="pl-8"
            aria-label="Buscar commits"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">{branch}</span> · {filtered.length} commit{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum commit encontrado para “{query}”.</p>
      ) : (
        groups.map(([day, items]) => (
          <section key={day} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <GitCommitHorizontalIcon className="size-4" />
              Commits em {formatLongDay(items[0].date)}
            </h3>
            <ul className="divide-y rounded-lg border">
              {items.map((commit) => (
                <li key={commit.sha} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium" title={commit.subject}>
                      {commit.subject}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {commit.author} fez o commit{" "}
                      <time dateTime={commit.date} title={formatDateTime(commit.date)}>
                        {formatRelative(commit.date)}
                      </time>
                    </p>
                  </div>
                  <ShaButton sha={commit.sha} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {filtered.length > shown && (
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={() => setShown((value) => value + PAGE)}>
            Mostrar mais ({filtered.length - shown} restantes)
          </Button>
        </div>
      )}
      {commits.length >= 300 && (
        <p className="text-center text-xs text-muted-foreground">Exibindo os 300 commits mais recentes.</p>
      )}
    </div>
  );
}
