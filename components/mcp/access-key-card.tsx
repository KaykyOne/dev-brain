"use client";

import { BanIcon, KeyRoundIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generateAccessKey, revokeAllTokens } from "@/lib/agent/actions";
import { formatDateTime } from "@/lib/format";

import { CopyButton } from "./copy-button";
import { InstallSnippets } from "./install-snippets";

type AccessKeyCardProps = {
  endpoint: string;
  /** Chave vigente (só metadados; o valor em claro nunca é guardado). */
  current: { prefix: string; createdAt: Date; lastUsedAt: Date | null } | null;
  /** Tokens ainda ativos, inclusive os de projeto do modelo antigo. */
  activeCount: number;
  legacyCount: number;
};

/** Chave única do MCP: gerar (revoga as anteriores e exibe uma vez) e revogar todos os tokens. */
export function AccessKeyCard({ endpoint, current, activeCount, legacyCount }: AccessKeyCardProps) {
  const router = useRouter();
  const [generating, startGenerate] = useTransition();
  const [revoking, startRevoke] = useTransition();
  const [created, setCreated] = useState<string | null>(null);

  function onGenerate() {
    if (current && !window.confirm("Gerar uma chave nova? A atual deixa de funcionar nos agentes que a usam.")) return;

    startGenerate(async () => {
      const result = await generateAccessKey();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCreated(result.data.token);
    });
  }

  function onRevokeAll() {
    if (!window.confirm(`Revogar todos os ${activeCount} tokens ativos? Nenhum agente acessará o MCP até gerar uma chave nova.`)) {
      return;
    }

    startRevoke(async () => {
      const result = await revokeAllTokens();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.revoked} token(s) revogado(s)`);
      router.refresh();
    });
  }

  function onClose(open: boolean) {
    if (open) return;
    // Fecha o fluxo: a chave em claro nunca mais fica disponível.
    setCreated(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chave de acesso</CardTitle>
        <CardDescription>
          Uma chave só, para todos os projetos. O que o agente acessa é decidido na aba Projetos (ativos ou não).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Chave atual</dt>
          <dd className="font-mono">{current ? `${current.prefix}…` : "Nenhuma"}</dd>
          {current && (
            <>
              <dt className="text-muted-foreground">Gerada em</dt>
              <dd>{formatDateTime(current.createdAt)}</dd>
              <dt className="text-muted-foreground">Último uso</dt>
              <dd>{current.lastUsedAt ? formatDateTime(current.lastUsedAt) : "Nunca"}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Tokens ativos</dt>
          <dd>
            {activeCount}
            {legacyCount > 0 && (
              <span className="text-muted-foreground">
                {" "}
                ({legacyCount} de projeto, do modelo antigo: já não funcionam, revogue-os)
              </span>
            )}
          </dd>
        </dl>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onGenerate} disabled={generating}>
            {generating ? <Loader2Icon className="animate-spin" /> : <KeyRoundIcon />}
            {current ? "Gerar nova chave" : "Gerar chave"}
          </Button>
          <Button variant="destructive" onClick={onRevokeAll} disabled={revoking || activeCount === 0}>
            {revoking ? <Loader2Icon className="animate-spin" /> : <BanIcon />}
            Revogar todos os tokens
          </Button>
        </div>
      </CardContent>

      <Dialog open={created !== null} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chave de acesso gerada</DialogTitle>
            <DialogDescription>Copie agora: por segurança, ela não será exibida novamente.</DialogDescription>
          </DialogHeader>
          {created && (
            <>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/50 px-3 py-2 font-mono text-xs">
                  {created}
                </code>
                <CopyButton value={created} />
              </div>
              <section className="min-w-0 space-y-3">
                <h3 className="text-sm font-semibold">Instale o MCP (uma vez por máquina)</h3>
                <InstallSnippets endpoint={endpoint} token={created} />
              </section>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
