"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Highlight } from "@/components/shared/highlight";
import { Badge } from "@/components/ui/badge";
import type { Project, Skill } from "@/db/schema";
import type { LibrarySkill } from "@/lib/skills/queries";
import { includesText, matchSkill } from "@/lib/skills/search";

import { SkillList } from "./skill-list";
import { SkillsSearch } from "./skills-search";

export type ProjectSkillGroup = {
  project: Pick<Project, "id" | "name" | "slug" | "repositoryPath">;
  skills: Skill[];
};

export type ProjectRef = { id: string; name: string };

const resultSummary = (shown: number, total: number) => `${shown} de ${total} ${total === 1 ? "skill" : "skills"}`;

/** Skills universais, com busca por título, descrição e conteúdo. */
export function UniversalSkills({ skills }: { skills: Skill[] }) {
  const [query, setQuery] = useState("");
  const term = query.trim();

  const visible = useMemo(() => (term ? skills.filter((skill) => matchSkill(skill, term).any) : skills), [skills, term]);

  return (
    <div className="space-y-3">
      {skills.length > 0 && (
        <SkillsSearch
          value={query}
          onChange={setQuery}
          label="Buscar nas skills universais"
          placeholder="Título, descrição ou conteúdo"
          summary={term ? resultSummary(visible.length, skills.length) : undefined}
        />
      )}
      <SkillList
        skills={visible}
        query={term}
        emptyTitle={term ? "Nenhuma skill encontrada" : "Nenhuma skill universal"}
        emptyDescription={
          term
            ? `Nada nas universais corresponde a “${term}”.`
            : "Crie skills que se aplicam a qualquer projeto, como “Revisar código” ou “Preparar Pull Request”."
        }
      />
    </div>
  );
}

/** Skills por projeto, com busca por nome do projeto, título, descrição e conteúdo. */
export function ProjectSkills({ groups, allProjects }: { groups: ProjectSkillGroup[]; allProjects: ProjectRef[] }) {
  const [query, setQuery] = useState("");
  const term = query.trim();

  const total = groups.reduce((sum, group) => sum + group.skills.length, 0);

  const visible = useMemo(() => {
    if (!term) return groups;

    return groups
      .map((group) => {
        // Acertou o nome do projeto: mostra todas as skills dele.
        const projectMatches = includesText(group.project.name, term);
        const skills = projectMatches ? group.skills : group.skills.filter((skill) => matchSkill(skill, term).any);
        return { ...group, skills };
      })
      .filter((group) => group.skills.length > 0);
  }, [groups, term]);

  const shown = visible.reduce((sum, group) => sum + group.skills.length, 0);

  return (
    <div className="space-y-4">
      {total > 0 && (
        <SkillsSearch
          value={query}
          onChange={setQuery}
          label="Buscar nas skills dos projetos"
          placeholder="Projeto, título, descrição ou conteúdo"
          summary={term ? resultSummary(shown, total) : undefined}
        />
      )}

      {total === 0 ? (
        <SkillList
          skills={[]}
          emptyTitle="Nenhuma skill de projeto"
          emptyDescription="Adicione ao cadastrar um projeto ou na aba Skills dele."
        />
      ) : visible.length === 0 ? (
        <SkillList skills={[]} emptyTitle="Nenhuma skill encontrada" emptyDescription={`Nada nos projetos corresponde a “${term}”.`} />
      ) : (
        <div className="space-y-6">
          {visible.map(({ project, skills }) => (
            <div key={project.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Link href={`/projects/${project.slug}`} className="font-medium hover:underline">
                  <Highlight text={project.name} query={term} />
                </Link>
                <Badge variant="outline">{skills.length}</Badge>
              </div>
              <SkillList skills={skills} project={project} query={term} allProjects={allProjects} emptyTitle="" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Biblioteca de skills genéricas, com busca por título, descrição, conteúdo e nome dos projetos em que estão aplicadas. */
export function LibrarySkills({ skills, projects }: { skills: LibrarySkill[]; projects: ProjectRef[] }) {
  const [query, setQuery] = useState("");
  const term = query.trim();

  const names = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);

  const visible = useMemo(
    () =>
      term
        ? skills.filter(
            (skill) =>
              matchSkill(skill, term).any || skill.projectIds.some((id) => includesText(names.get(id) ?? "", term)),
          )
        : skills,
    [skills, names, term],
  );

  return (
    <div className="space-y-3">
      {skills.length > 0 && (
        <SkillsSearch
          value={query}
          onChange={setQuery}
          label="Buscar na biblioteca"
          placeholder="Título, descrição, conteúdo ou projeto"
          summary={term ? resultSummary(visible.length, skills.length) : undefined}
        />
      )}
      <SkillList
        skills={visible}
        query={term}
        allProjects={projects}
        emptyTitle={term ? "Nenhuma skill encontrada" : "A biblioteca está vazia"}
        emptyDescription={
          term
            ? `Nada na biblioteca corresponde a “${term}”.`
            : "Guarde aqui skills genéricas, como o seu fluxo de autodeploy, e aplique só aos projetos que as usam."
        }
      />
    </div>
  );
}
