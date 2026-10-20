import "server-only";

import { and, count, desc, eq, or } from "drizzle-orm";

import { db } from "@/db";
import { activityLogs, changeProposals, projects, skills } from "@/db/schema";
import { getCommitActivity, getRecentCommits, getRepoSummaries } from "@/lib/projects/repo-info";

export async function getDashboardData(ownerId: string) {
  const [ownedProjects, [skillCount], [pendingCount], recentActivity] = await Promise.all([
    db.select().from(projects).where(eq(projects.ownerId, ownerId)),
    db.select({ value: count() }).from(skills).where(eq(skills.ownerId, ownerId)),
    db
      .select({ value: count() })
      .from(changeProposals)
      .innerJoin(projects, eq(projects.id, changeProposals.projectId))
      .where(and(eq(projects.ownerId, ownerId), eq(changeProposals.status, "pending"))),
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

  const [summaries, recentCommits, commitActivity] = await Promise.all([
    getRepoSummaries(ownedProjects),
    getRecentCommits(ownedProjects, 6),
    getCommitActivity(ownedProjects, 30),
  ]);
  const contextCount = [...summaries.values()].reduce((total, info) => total + (info?.files.length ?? 0), 0);

  return {
    projects: ownedProjects.length,
    contexts: contextCount,
    skills: skillCount.value,
    pendingChanges: pendingCount.value,
    recentCommits,
    commitActivity,
    recentActivity,
  };
}
