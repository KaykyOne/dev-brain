import type { Metadata } from "next";
import Link from "next/link";

import { LogFilters, logsHref } from "@/components/logs/log-filters";
import { LogList } from "@/components/logs/log-list";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/dal";
import { LOG_RETENTION_DAYS } from "@/lib/logger";
import { listLogs } from "@/lib/logs/queries";
import { cn } from "@/lib/utils";
import { logsSearchSchema } from "@/lib/validations/logs";

export const metadata: Metadata = { title: "Logs" };

export default async function LogsPage({ searchParams }: PageProps<"/logs">) {
  await getCurrentUser();

  const raw = await searchParams;
  const { level, q, page } = logsSearchSchema.parse({
    level: typeof raw.level === "string" ? raw.level : undefined,
    q: typeof raw.q === "string" ? raw.q : undefined,
    page: typeof raw.page === "string" ? raw.page : 1,
  });
  const { rows, total, pages } = await listLogs({ level, q, page });

  return (
    <>
      <PageHeader title={<>Logs</>} description={<>Erros, avisos e eventos do servidor. Os registros são mantidos por {LOG_RETENTION_DAYS} dias.</>} />

      <LogFilters level={level} q={q} />
      <LogList logs={rows} />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} {total === 1 ? "registro" : "registros"} · página {Math.min(page, pages)} de {pages}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={logsHref({ level, q, page: page - 1 })} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Anterior
            </Link>
          )}
          {page < pages && (
            <Link href={logsHref({ level, q, page: page + 1 })} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Próxima
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
