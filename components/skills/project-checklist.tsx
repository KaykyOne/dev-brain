"use client";

import { Checkbox } from "@/components/ui/checkbox";

type ProjectChecklistProps = {
  projects: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Ids exibidos marcados e bloqueados (ex.: o projeto de origem, que mantém a skill). */
  lockedIds?: string[];
};

/** Lista de projetos com caixas de seleção e atalho para marcar todos. */
export function ProjectChecklist({ projects, value, onChange, lockedIds = [] }: ProjectChecklistProps) {
  const selectable = projects.filter((project) => !lockedIds.includes(project.id));
  const allSelected = selectable.length > 0 && selectable.every((project) => value.includes(project.id));

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...new Set([...value, id])] : value.filter((item) => item !== id));
  }

  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">Você ainda não tem projetos. Crie um para aplicar a skill.</p>;
  }

  return (
    <div className="space-y-2">
      {selectable.length > 1 && (
        <button
          type="button"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => onChange(allSelected ? [] : selectable.map((project) => project.id))}
        >
          {allSelected ? "Desmarcar todos" : "Selecionar todos"}
        </button>
      )}
      <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
        {projects.map((project) => {
          const locked = lockedIds.includes(project.id);
          return (
            <li key={project.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                <Checkbox
                  checked={locked || value.includes(project.id)}
                  disabled={locked}
                  onCheckedChange={(checked) => toggle(project.id, checked === true)}
                />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                {locked && <span className="shrink-0 text-xs text-muted-foreground">origem (mantida)</span>}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
