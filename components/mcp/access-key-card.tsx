"use client";

import { BanIcon, EyeIcon, EyeOffIcon, KeyRoundIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateAccessKey, revokeAllTokens } from "@/lib/agent/actions";
import { maskToken } from "@/lib/agent/instructions";
import { formatDateTime } from "@/lib/format";

import { CopyButton } from "./copy-button";

export type AccessKey = {
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  /** Valor em claro; null nas chaves geradas antes de serem guardadas cifradas. */
  token: string | null;
};

type AccessKeyCardProps = {
  current: AccessKey | null;
  /** Tokens ainda ativos, inclusive os de projeto do modelo antigo. */
  activeCount: number;
  legacyCount: number;
  revealed: boolean;
  onRevealedChange: (revealed: boolean) => void;
};

/** Chave única do MCP: ver e copiar a atual, gerar outra (revoga as anteriores) e revogar todos os tokens. */
export function AccessKeyCard({ current, activeCount, legacyCount, revealed, onRevealedChange }: AccessKeyCardProps) {
  const router = useRouter();
  const [generating, startGenerate] = useTransition();
  const [revoking, startRevoke] = useTransition();

  function onGenerate() {
    if (current && !window.confirm("Gerar uma chave nova? A atual deixa de funcionar nos agentes que a usam.")) return;

    startGenerate(async () => {
      const result = await generateAccessKey();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Chave gerada: os comandos de instalação já usam a nova");
      onRevealedChange(true);
      router.refresh();
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
      onRevealedChange(false);
      router.refresh();
    });
  }

  const token = current?.token ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chave de acesso</CardTitle>
        <CardDescription>
          Uma chave só, para todos os projetos. O que o agente acessa é decidido na aba Projetos (ativos ou não).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {token ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/50 px-3 py-2 font-mono text-xs">
              {revealed ? token : maskToken(token)}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRevealedChange(!revealed)}
              aria-pressed={revealed}
            >
              {revealed ? <EyeOffIcon /> : <EyeIcon />}
              {revealed ? "Ocultar" : "Mostrar"}
            </Button>
            <CopyButton value={token} />
          </div>
        ) : (
          current && (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Esta chave foi gerada antes de o DevBrain guardá-la para exibir de novo. Gere uma nova para vê-la e
              copiá-la aqui sempre que precisar.
            </p>
          )
        )}

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
    </Card>
  );
}
