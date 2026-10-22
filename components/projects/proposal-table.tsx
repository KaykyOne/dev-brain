"use client";

import { CheckIcon, GitPullRequestIcon, Loader2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChangeProposal } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { approveProposal, rejectProposal } from "@/lib/projects/proposal-actions";

const STATUS = {
  pending: { label: "Pendente", variant: "outline" },
  approved: { label: "Aprovada", variant: "secondary" },
  rejected: { label: "Recusada", variant: "destructive" },
  published: { label: "Aprovada e gravada", variant: "default" },
  conflict: { label: "Conflito", variant: "destructive" },
} as const;

const Block = ({ title, children }: { title: string; children: string }) => (
  <div className="min-w-0 flex-1 space-y-1">
    <p className="text-xs font-medium text-muted-foreground">{title}</p>
    <pre className="max-h-72 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
      {children}
    </pre>
  </div>
);

function ReviewActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function review(action: typeof approveProposal, success: string) {
    startTransition(async () => {
      const result = await action(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => review(approveProposal, "Alteração aprovada e gravada no repositório")}>
        {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Aprovar
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => review(rejectProposal, "Alteração recusada")}>
        <XIcon /> Recusar
      </Button>
    </div>
  );
}

/** `currentContents`: conteúdo atual de cada arquivo (caminho → texto), para comparar com o proposto. */
export function ProposalTable({
  proposals,
  currentContents = {},
}: {
  proposals: ChangeProposal[];
  currentContents?: Record<string, string>;
}) {
  if (proposals.length === 0) {
    return (
      <EmptyState
        icon={GitPullRequestIcon}
        title="Nenhuma proposta de alteração"
        description="Propostas criadas por agentes aparecerão aqui para você aprovar ou recusar."
      />
    );
  }

  return (
    <Accordion className="rounded-lg border px-4">
      {proposals.map((proposal) => {
        const status = STATUS[proposal.status];
        const current = currentContents[proposal.filePath];

        return (
          <AccordionItem key={proposal.id} value={proposal.id}>
            <AccordionTrigger>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                <Badge variant={status.variant}>{status.label}</Badge>
                <span className="font-mono text-xs">{proposal.filePath}</span>
                <span className="text-xs font-normal text-muted-foreground">{proposal.source}</span>
                <span className="text-xs font-normal text-muted-foreground">{formatDateTime(proposal.createdAt)}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-sm">
                <span className="text-muted-foreground">Motivo: </span>
                {proposal.reason}
              </p>
              {proposal.failureReason && <p className="text-sm text-destructive">Falha: {proposal.failureReason}</p>}
              <div className="flex flex-col gap-3 lg:flex-row">
                <Block title="Atual">{current ?? "(arquivo novo)"}</Block>
                <Block title="Proposto">{proposal.proposedContent}</Block>
              </div>
              {proposal.status === "pending" && <ReviewActions id={proposal.id} />}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
