import { SearchIcon } from "lucide-react";
import Form from "next/form";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LOG_LEVELS, type LogsSearch } from "@/lib/validations/logs";
import { cn } from "@/lib/utils";

import { LEVEL_META } from "./log-list";

/** URL da página de logs com os filtros dados (a página volta para 1 ao trocar de filtro). */
export function logsHref({ level, q, page }: Partial<LogsSearch>) {
  const params = new URLSearchParams();
  if (level) params.set("level", level);
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/logs?${query}` : "/logs";
}

export function LogFilters({ level, q }: Pick<LogsSearch, "level" | "q">) {
  const options = [{ value: undefined, label: "Todos" }, ...LOG_LEVELS.map((value) => ({ value, label: LEVEL_META[value].label }))];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Filtrar por nível" className="flex gap-1">
        {options.map((option) => (
          <Link
            key={option.label}
            href={logsHref({ level: option.value, q })}
            className={cn(buttonVariants({ variant: option.value === level ? "secondary" : "ghost", size: "sm" }))}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      <Form action="/logs" className="w-full sm:w-auto">
        {level && <input type="hidden" name="level" value={level} />}
        <div className="relative w-full sm:w-auto">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Buscar mensagem ou origem" className="w-full pl-8 sm:w-64" />
        </div>
      </Form>
    </div>
  );
}
