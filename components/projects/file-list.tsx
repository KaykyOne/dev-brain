import { FileTextIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import type { ContextFile } from "@/db/schema";
import { formatDateTime } from "@/lib/format";

export function FileList({ files, emptyTitle }: { files: ContextFile[]; emptyTitle: string }) {
  if (files.length === 0) {
    return (
      <EmptyState
        icon={FileTextIcon}
        title={emptyTitle}
        description="Os arquivos aparecem aqui após a sincronização com o repositório GitHub."
      />
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {files.map((file) => (
        <li key={file.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-mono">{file.path}</span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {file.lastCommitSha ? file.lastCommitSha.slice(0, 7) : "—"}
            {file.lastSyncedAt && ` · ${formatDateTime(file.lastSyncedAt)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
