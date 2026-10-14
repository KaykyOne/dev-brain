import { GitPullRequestIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ChangeProposal } from "@/db/schema";
import { formatDateTime } from "@/lib/format";

const STATUS = {
  pending: { label: "Pendente", variant: "outline" },
  approved: { label: "Aprovada", variant: "secondary" },
  rejected: { label: "Rejeitada", variant: "destructive" },
  published: { label: "Publicada", variant: "default" },
  conflict: { label: "Conflito", variant: "destructive" },
} as const;

export function ProposalTable({ proposals }: { proposals: ChangeProposal[] }) {
  if (proposals.length === 0) {
    return (
      <EmptyState
        icon={GitPullRequestIcon}
        title="Nenhuma proposta de alteração"
        description="Propostas criadas por você ou por agentes aparecerão aqui para revisão."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Arquivo</TableHead>
          <TableHead>Origem</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Criada em</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {proposals.map((proposal) => (
          <TableRow key={proposal.id}>
            <TableCell className="font-mono text-xs">{proposal.filePath}</TableCell>
            <TableCell>{proposal.source}</TableCell>
            <TableCell>
              <Badge variant={STATUS[proposal.status].variant}>{STATUS[proposal.status].label}</Badge>
            </TableCell>
            <TableCell className="text-right">{formatDateTime(proposal.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
