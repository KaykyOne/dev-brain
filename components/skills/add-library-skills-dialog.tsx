"use client";

import { LibraryIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { linkLibrarySkills } from "@/lib/skills/actions";

type AddLibrarySkillsDialogProps = {
  projectId: string;
  projectName: string;
  /** Skills da biblioteca que ainda não estão aplicadas a este projeto. */
  available: { id: string; name: string; description: string }[];
};

/** Na aba Skills de um projeto: escolhe skills da biblioteca para aplicar a ele. */
export function AddLibrarySkillsDialog({ projectId, projectName, available }: AddLibrarySkillsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) setSelected([]);
  }

  async function save() {
    setSaving(true);
    const result = await linkLibrarySkills(projectId, selected);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${selected.length} ${selected.length === 1 ? "skill aplicada" : "skills aplicadas"}`);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" />}>
        <LibraryIcon /> Da biblioteca
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aplicar skills da biblioteca</DialogTitle>
          <DialogDescription>Escolha as skills genéricas que {projectName} também usa.</DialogDescription>
        </DialogHeader>

        {available.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma skill disponível: todas as da biblioteca já estão neste projeto, ou a biblioteca está vazia.
          </p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
            {available.map((skill) => (
              <li key={skill.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                  <Checkbox
                    className="mt-0.5"
                    checked={selected.includes(skill.id)}
                    onCheckedChange={(checked) =>
                      setSelected((current) => (checked === true ? [...current, skill.id] : current.filter((id) => id !== skill.id)))
                    }
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{skill.name}</span>
                    <span className="block text-xs text-muted-foreground">{skill.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={saving || selected.length === 0}>
            {saving && <Loader2Icon className="animate-spin" />}
            Aplicar {selected.length > 0 ? `(${selected.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
