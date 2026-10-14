const UNIVERSAL_ROOT = "devbrain/global/skills";

/** Onde o SKILL.md fica no repositório (convenção do DevBrain). */
export function skillRepoPath(skill: {
  slug: string;
  project?: { slug: string; repositoryPath: string | null } | null;
}): string {
  if (!skill.project) return `${UNIVERSAL_ROOT}/${skill.slug}/SKILL.md`;

  const root = skill.project.repositoryPath ?? `devbrain/projects/${skill.project.slug}`;
  return `${root}/skills/${skill.slug}/SKILL.md`;
}
