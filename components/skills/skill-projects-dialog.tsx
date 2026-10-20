"use client";

import { Loader2Icon, PlugZapIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { setSkillProjects } from "@/lib/skills/actions";

import { ProjectChecklist } from "./project-checklist";

type SkillProjectsDialogProps = {
  skill: { id: string; name: string };
  projects: { id: string; name: string }[];
  /** Projetos em que a skill está aplicada hoje. */
  applied: string[];
};

/** Escolhe em quais projetos uma skill da biblioteca está aplicada. */
export function SkillProjectsDialog({ skill, projects, applied }: SkillProjectsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(applied);
  const [saving, setSaving] = useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) setSelected(applied);
  }

  async function save() {
    setSaving(true);
    const result = await setSkillProjects(skill.id, selected);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(selected.length === 0 ? "Skill removida de todos os projetos" : `Aplicada em ${selected.length} ${selected.length === 1 ? "projeto" : "projetos"}`);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Aplicar ${skill.name} em projetos`} title="Aplicar em projetos" />}
      >
        <PlugZapIcon />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aplicar em projetos</DialogTitle>
          <DialogDescription>
            Escolha os projetos que usam “{skill.name}”. O conteúdo fica na biblioteca, sem cópias: editar a skill
            atualiza todos eles.
          </DialogDescription>
        </DialogHeader>
        <ProjectChecklist projects={projects} value={selected} onChange={setSelected} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving && <Loader2Icon className="animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
