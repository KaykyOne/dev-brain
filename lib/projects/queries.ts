import "server-only";

import { and, count, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { changeProposals, contextFiles, projects, syncLogs } from "@/db/schema";

export function listProjects(ownerId: string) {
  return db.select().from(projects).where(eq(projects.ownerId, ownerId)).orderBy(desc(projects.updatedAt));
}

/** Busca o projeto restrito ao dono; 404 se não existir ou pertencer a outro usuário. */
export async function getProjectBySlug(ownerId: string, slug: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerId, ownerId), eq(projects.slug, slug)))
    .limit(1);

  if (!project) notFound();
  return project;
}

export async function getProjectDetail(ownerId: string, slug: string) {
  const project = await getProjectBySlug(ownerId, slug);

  const [files, proposals, [{ pending }], [lastSync]] = await Promise.all([
    db.select().from(contextFiles).where(eq(contextFiles.projectId, project.id)).orderBy(contextFiles.path),
    db
      .select()
      .from(changeProposals)
      .where(eq(changeProposals.projectId, project.id))
      .orderBy(desc(changeProposals.createdAt))
      .limit(50),
    db
      .select({ pending: count() })
      .from(changeProposals)
      .where(and(eq(changeProposals.projectId, project.id), eq(changeProposals.status, "pending"))),
    db
      .select()
      .from(syncLogs)
      .where(eq(syncLogs.projectId, project.id))
      .orderBy(desc(syncLogs.createdAt))
      .limit(1),
  ]);

  return { project, files, proposals, pendingCount: pending, lastSync: lastSync ?? null };
}
