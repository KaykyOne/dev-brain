import { KeyRoundIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { listAgentTokens } from "@/lib/agent/queries";
import { evaluateToken } from "@/lib/agent/token";
import { formatDateTime } from "@/lib/format";

import { RevokeTokenButton } from "./revoke-token-button";

type Tokens = Awaited<ReturnType<typeof listAgentTokens>>;

const STATE = {
  ok: { label: "Ativo", variant: "secondary" },
  revoked: { label: "Revogado", variant: "destructive" },
  expired: { label: "Expirado", variant: "outline" },
} as const;

export function TokenTable({ tokens, now }: { tokens: Tokens; now: Date }) {
  if (tokens.length === 0) {
    return (
      <EmptyState
        icon={KeyRoundIcon}
        title="Nenhum token criado"
        description="Crie um token para conectar o Claude Code ou o Codex a um projeto."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Projeto</TableHead>
          <TableHead>Escopos</TableHead>
          <TableHead>Último uso</TableHead>
          <TableHead>Expira</TableHead>
          <TableHead>Status</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {tokens.map((token) => {
          const state = evaluateToken(token, now);
          return (
            <TableRow key={token.id}>
              <TableCell>
                <p className="font-medium">{token.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{token.prefix}…</p>
              </TableCell>
              <TableCell>{token.projectName ?? <Badge variant="secondary">Conta (hub)</Badge>}</TableCell>
              <TableCell className="space-x-1">
                {token.scopes.map((scope) => (
                  <Badge key={scope} variant="outline" className="font-mono">
                    {scope}
                  </Badge>
                ))}
              </TableCell>
              <TableCell>{token.lastUsedAt ? formatDateTime(token.lastUsedAt) : "Nunca"}</TableCell>
              <TableCell>{token.expiresAt ? formatDateTime(token.expiresAt) : "Nunca"}</TableCell>
              <TableCell>
                <Badge variant={STATE[state].variant}>{STATE[state].label}</Badge>
              </TableCell>
              <TableCell className="text-right">
                {state === "ok" && <RevokeTokenButton id={token.id} name={token.name} />}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
