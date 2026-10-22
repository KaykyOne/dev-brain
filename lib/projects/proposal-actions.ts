"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { changeProposals, projects } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { fail, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/dal";
import { contextRepos, RepoError } from "@/lib/context-repo";
import { logger } from "@/lib/logger";
import { findSecrets } from "@/lib/security/secrets";

/** Proposta pendente de um projeto do usuário; qualquer outra combinação vira "não encontrada". */
async function findPending(ownerId: string, id: string) {
  const [row] = await db
    .select({ proposal: changeProposals, project: projects })
    .from(changeProposals)
    .innerJoin(projects, eq(projects.id, changeProposals.projectId))
    .where(and(eq(changeProposals.id, id), eq(projects.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

/** Aprova: grava o arquivo no repositório de contexto (um commit local, sem push) e marca a proposta como publicada. */
export async function approveProposal(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  const found = await findPending(user.id, id);
  if (!found) return fail("Proposta não encontrada");

  const { proposal, project } = found;
  if (proposal.status !== "pending") return fail("Esta proposta já foi analisada");

  const secrets = findSecrets(proposal.proposedContent);
  if (secrets.length > 0) return fail(`O conteúdo parece conter segredos (${secrets.join(", ")}). Recuse a proposta.`);

  try {
    await contextRepos.init({ name: project.name, slug: project.slug, description: project.description }, project.defaultBranch);

    const reason = proposal.reason.replace(/\s+/g, " ").trim();
    const result = await contextRepos.write(project.slug, proposal.filePath, proposal.proposedContent, {
      message: `docs: ${reason}`.slice(0, 200),
      author: proposal.source,
    });

    const now = new Date();
    await db
      .update(changeProposals)
      .set({ status: "published", approvedAt: now, publishedAt: now, failureReason: null })
      .where(and(eq(changeProposals.id, id), eq(changeProposals.status, "pending")));

    await logActivity({
      action: "proposal.approved",
      actorId: user.id,
      projectId: project.id,
      metadata: { filePath: proposal.filePath, sha: result.sha, source: proposal.source },
    });

    return { ok: true, data: undefined };
  } catch (error) {
    const message = error instanceof RepoError ? error.message : "Erro interno ao gravar no repositório";
    if (!(error instanceof RepoError)) await logger.error("proposals", "Falha ao aprovar proposta", { error });
    await db.update(changeProposals).set({ failureReason: message }).where(eq(changeProposals.id, id));
    return fail(message);
  }
}

export async function rejectProposal(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  const found = await findPending(user.id, id);
  if (!found) return fail("Proposta não encontrada");
  if (found.proposal.status !== "pending") return fail("Esta proposta já foi analisada");

  await db
    .update(changeProposals)
    .set({ status: "rejected" })
    .where(and(eq(changeProposals.id, id), eq(changeProposals.status, "pending")));

  await logActivity({
    action: "proposal.rejected",
    actorId: user.id,
    projectId: found.project.id,
    metadata: { filePath: found.proposal.filePath, source: found.proposal.source },
  });

  return { ok: true, data: undefined };
}
