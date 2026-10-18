import { ScrollTextIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { AppLog } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import type { LogLevel } from "@/lib/validations/logs";

export const LEVEL_META: Record<LogLevel, { label: string; variant: "destructive" | "outline" | "secondary" }> = {
  error: { label: "Erro", variant: "destructive" },
  warn: { label: "Aviso", variant: "outline" },
  info: { label: "Info", variant: "secondary" },
};

const Block = ({ title, children }: { title: string; children: string }) => (
  <div className="space-y-1">
    <p className="text-xs font-medium text-muted-foreground">{title}</p>
    <pre className="max-h-72 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
      {children}
    </pre>
  </div>
);

export function LogList({ logs }: { logs: AppLog[] }) {
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={ScrollTextIcon}
        title="Nenhum log encontrado"
        description="Erros, avisos e eventos do servidor aparecem aqui. Tente remover os filtros."
      />
    );
  }

  return (
    <Accordion className="rounded-lg border px-4">
      {logs.map((log) => {
        const meta = LEVEL_META[log.level];
        const hasDetails = Object.keys(log.details).length > 0;

        return (
          <AccordionItem key={log.id} value={log.id}>
            <AccordionTrigger>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                <Badge variant={meta.variant}>{meta.label}</Badge>
                <span className="font-mono text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                <span className="font-mono text-xs text-muted-foreground">{log.scope}</span>
                <span className="min-w-0 basis-full truncate text-sm font-normal sm:basis-auto sm:flex-1">
                  {log.message}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <Block title="Mensagem">{log.message}</Block>
              {hasDetails && <Block title="Detalhes">{JSON.stringify(log.details, null, 2)}</Block>}
              {log.stack && <Block title="Stack">{log.stack}</Block>}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
