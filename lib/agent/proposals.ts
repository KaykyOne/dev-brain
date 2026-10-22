import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { changeProposals, contextFiles } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { normalizeRelativePath } from "@/lib/security/paths";
import { findSecrets } from "@/lib/security/secrets";

import type { AgentContext } from "./auth";

const MAX_CONTENT_LENGTH = 100_000;

export const proposeChangeSchema = z.object({
  file_path: z.string().trim().min(1).max(300),
  content: z.string().min(1).max(MAX_CONTENT_LENGTH),
  reason: z.string().trim().min(1).max(1000),
  code_reference: z.string().trim().max(300).optional(),
});

export type ProposeChangeResult =
  | { ok: true; id: string; status: string; duplicate: boolean }
  | { ok: false; error: string };

export async function createAgentProposal(
  context: AgentContext,
  input: z.infer<typeof proposeChangeSchema>,
): Promise<ProposeChangeResult> {
  const filePath = normalizeRelativePath(input.file_path);
  if (!filePath || !filePath.endsWith(".md")) {
    return { ok: false, error: "file_path deve ser um caminho relativo ao projeto, terminando em .md" };
  }

  const secrets = findSecrets(input.content);
  if (secrets.length > 0) {
    return { ok: false, error: `O conteúdo parece conter segredos (${secrets.join(", ")}). Remova antes de propor.` };
  }

  if (!context.project) return { ok: false, error: "Token de conta não pode propor alterações em projetos." };
  const projectId = context.project.id;

  const [duplicate] = await db
    .select({ id: changeProposals.id, status: changeProposals.status })
    .from(changeProposals)
    .where(
      and(
        eq(changeProposals.projectId, projectId),
        eq(changeProposals.filePath, filePath),
        eq(changeProposals.status, "pending"),
        eq(changeProposals.proposedContent, input.content),
      ),
    )
    .limit(1);

  if (duplicate) return { ok: true, id: duplicate.id, status: duplicate.status, duplicate: true };

  const [existing] = await db
    .select({ lastCommitSha: contextFiles.lastCommitSha })
    .from(contextFiles)
    .where(and(eq(contextFiles.projectId, projectId), eq(contextFiles.path, filePath)))
    .limit(1);

  const [proposal] = await db
    .insert(changeProposals)
    .values({
      projectId,
      filePath,
      baseCommitSha: existing?.lastCommitSha ?? null,
      proposedContent: input.content,
      reason: input.reason,
      source: `agent:${context.tokenName}`,
      codeReference: input.code_reference ?? null,
    })
    .returning({ id: changeProposals.id, status: changeProposals.status });

  await logActivity({
    action: "proposal.created",
    projectId,
    metadata: { filePath, source: `agent:${context.tokenName}` },
  });

  await notify({
    ownerId: context.ownerId,
    projectId,
    kind: "proposal.created",
    title: "IA solicitou aprovação",
    body: `${context.project.name}: ${filePath} — ${input.reason}`.slice(0, 300),
    href: `/projects/${context.project.slug}?tab=changes`,
  });

  return { ok: true, id: proposal.id, status: proposal.status, duplicate: false };
}
