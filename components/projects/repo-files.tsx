import { FileTextIcon, FolderIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";

/** Agrupa os caminhos por pasta de primeiro nível; arquivos da raiz vêm primeiro. */
function groupByFolder(files: string[]) {
  const groups = new Map<string, string[]>();
  for (const file of files) {
    const folder = file.includes("/") ? file.slice(0, file.indexOf("/")) : "";
    groups.set(folder, [...(groups.get(folder) ?? []), file]);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
}

export function RepoFiles({ slug, files }: { slug: string; files: string[] }) {
  if (files.length === 0) {
    return (
      <EmptyState
        icon={FileTextIcon}
        title="Repositório vazio"
        description="Os arquivos aparecem aqui assim que o primeiro commit for feito."
      />
    );
  }

  return (
    <div className="space-y-4">
      {groupByFolder(files).map(([folder, entries]) => (
        <section key={folder || "root"} className="space-y-1.5">
          {folder && (
            <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <FolderIcon className="size-3.5" /> {folder}/
            </h3>
          )}
          <ul className="divide-y rounded-lg border">
            {entries.map((file) => (
              <li key={file}>
                <Link
                  href={`/projects/${slug}/files/${file.split("/").map(encodeURIComponent).join("/")}`}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted/50"
                >
                  <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-mono">{file}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
