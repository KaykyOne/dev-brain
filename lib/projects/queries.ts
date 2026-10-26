import "server-only";

import { and, count, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { changeProposals, projects } from "@/db/schema";

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

export function listProposals(projectId: string) {
  return db
    .select()
    .from(changeProposals)
    .where(eq(changeProposals.projectId, projectId))
    .orderBy(desc(changeProposals.createdAt))
    .limit(50);
}

/** Projeto e contagem de pendências; as propostas em si carregam sob demanda (`listProposals`). */
export async function getProjectDetail(ownerId: string, slug: string) {
  const project = await getProjectBySlug(ownerId, slug);

  const [{ pending }] = await db
    .select({ pending: count() })
    .from(changeProposals)
    .where(and(eq(changeProposals.projectId, project.id), eq(changeProposals.status, "pending")));

  return { project, pendingCount: pending };
}
