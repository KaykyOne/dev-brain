import "server-only";

import { and, count, desc, eq, or } from "drizzle-orm";

import { db } from "@/db";
import { activityLogs, changeProposals, contextFiles, projects, skills, syncLogs } from "@/db/schema";

export async function getDashboardData(ownerId: string) {
  const [[projectCount], [contextCount], [skillCount], [pendingCount], recentSyncs, recentActivity] =
    await Promise.all([
      db.select({ value: count() }).from(projects).where(eq(projects.ownerId, ownerId)),
      db
        .select({ value: count() })
        .from(contextFiles)
        .innerJoin(projects, eq(projects.id, contextFiles.projectId))
        .where(eq(projects.ownerId, ownerId)),
      db.select({ value: count() }).from(skills).where(eq(skills.ownerId, ownerId)),
      db
        .select({ value: count() })
        .from(changeProposals)
        .innerJoin(projects, eq(projects.id, changeProposals.projectId))
        .where(and(eq(projects.ownerId, ownerId), eq(changeProposals.status, "pending"))),
      db
        .select({
          id: syncLogs.id,
          status: syncLogs.status,
          createdAt: syncLogs.createdAt,
          projectName: projects.name,
          projectSlug: projects.slug,
        })
        .from(syncLogs)
        .innerJoin(projects, eq(projects.id, syncLogs.projectId))
        .where(eq(projects.ownerId, ownerId))
        .orderBy(desc(syncLogs.createdAt))
        .limit(5),
      db
        .select({
          id: activityLogs.id,
          action: activityLogs.action,
          metadata: activityLogs.metadata,
          createdAt: activityLogs.createdAt,
        })
        .from(activityLogs)
        .leftJoin(projects, eq(projects.id, activityLogs.projectId))
        .where(or(eq(activityLogs.actorId, ownerId), eq(projects.ownerId, ownerId)))
        .orderBy(desc(activityLogs.createdAt))
        .limit(8),
    ]);

  return {
    projects: projectCount.value,
    contexts: contextCount.value,
    skills: skillCount.value,
    pendingChanges: pendingCount.value,
    recentSyncs,
    recentActivity,
  };
}
