"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteProject } from "@/lib/projects/actions";

export function DeleteProjectDialog({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const result = await deleteProject(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Projeto removido");
      setOpen(false);
      router.replace("/projects");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" />}>
        <Trash2Icon /> Remover projeto
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover “{name}”?</DialogTitle>
          <DialogDescription>
            Os metadados, propostas e tokens deste projeto serão apagados do DevBrain. Os arquivos no
            repositório Git não são afetados.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
