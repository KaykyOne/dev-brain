import { CompassIcon, LayoutDashboardIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { BackButton } from "./back-button";

type NotFoundViewProps = {
  title?: string;
  description?: string;
  /** `page` ocupa a tela toda; `embedded` fica dentro do layout do dashboard. */
  variant?: "page" | "embedded";
};

export function NotFoundView({
  title = "Página não encontrada",
  description = "O endereço pode estar incorreto, ou o conteúdo foi movido ou removido.",
  variant = "page",
}: NotFoundViewProps) {
  return (
    <div
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center",
        variant === "page" ? "min-h-svh bg-muted/30" : "min-h-[60svh]",
      )}
    >
      {/* Numeral decorativo ao fundo; o conteúdo real fica por cima. */}
      <p
        aria-hidden
        className="pointer-events-none absolute select-none font-mono text-[min(40vw,22rem)] leading-none font-bold tracking-tighter text-foreground/[0.04]"
      >
        404
      </p>

      <div className="relative flex max-w-md flex-col items-center gap-6">
        <div className="flex size-14 items-center justify-center rounded-2xl border bg-background shadow-sm">
          <CompassIcon className="size-7 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <p className="font-mono text-sm font-medium text-muted-foreground">Erro 404</p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
          <p className="text-muted-foreground text-balance">{description}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard" className={cn(buttonVariants())}>
            <LayoutDashboardIcon /> Ir para o dashboard
          </Link>
          <BackButton />
        </div>
      </div>
    </div>
  );
}
