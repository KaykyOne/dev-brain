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

type Token = Tokens[number];

const TokenProject = ({ token }: { token: Token }) =>
  token.projectName ?? <Badge variant="secondary">Conta (hub)</Badge>;

const TokenScopes = ({ token }: { token: Token }) => (
  <div className="flex flex-wrap gap-1">
    {token.scopes.map((scope) => (
      <Badge key={scope} variant="outline" className="font-mono">
        {scope}
      </Badge>
    ))}
  </div>
);

const lastUsed = (token: Token) => (token.lastUsedAt ? formatDateTime(token.lastUsedAt) : "Nunca");
const expires = (token: Token) => (token.expiresAt ? formatDateTime(token.expiresAt) : "Nunca");

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
    <>
      {/* Abaixo de lg: um cartão por token, sem rolagem horizontal (a tabela tem 7 colunas). */}
      <ul className="divide-y rounded-lg border lg:hidden">
        {tokens.map((token) => {
          const state = evaluateToken(token, now);
          return (
            <li key={token.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{token.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{token.prefix}…</p>
                </div>
                <Badge variant={STATE[state].variant}>{STATE[state].label}</Badge>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Projeto</dt>
                  <dd className="truncate">
                    <TokenProject token={token} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Último uso</dt>
                  <dd>{lastUsed(token)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Expira</dt>
                  <dd>{expires(token)}</dd>
                </div>
              </dl>
              <TokenScopes token={token} />
              {state === "ok" && <RevokeTokenButton id={token.id} name={token.name} />}
            </li>
          );
        })}
      </ul>

      <Table className="hidden lg:table">
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
                <TableCell>
                  <TokenProject token={token} />
                </TableCell>
                <TableCell>
                  <TokenScopes token={token} />
                </TableCell>
                <TableCell>{lastUsed(token)}</TableCell>
                <TableCell>{expires(token)}</TableCell>
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
    </>
  );
}
