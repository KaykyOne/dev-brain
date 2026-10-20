import { SKILL_TARGET_LIBRARY, SKILL_TARGET_UNIVERSAL } from "@/lib/validations/skill";

/** Opções de destino ao criar ou importar skills: universal, biblioteca ou um projeto. */
export function skillTargetItems(projects: { id: string; name: string }[]): Record<string, string> {
  return {
    [SKILL_TARGET_UNIVERSAL]: "Universal (todos os projetos)",
    [SKILL_TARGET_LIBRARY]: "Biblioteca (aplicar a projetos escolhidos)",
    ...Object.fromEntries(projects.map((project) => [project.id, project.name])),
  };
}
