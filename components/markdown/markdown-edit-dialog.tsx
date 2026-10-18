"use client";

import { PencilIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { MarkdownEditor } from "./markdown-editor";

type MarkdownEditDialogProps = {
  title: string;
  description?: string;
  value: string;
  onSave: (value: string) => void;
  /** Texto do botão que abre o editor. */
  label?: string;
};

/** Abre o editor Markdown em um diálogo; só aplica o texto ao confirmar. */
export function MarkdownEditDialog({ title, description, value, onSave, label = "Editar conteúdo" }: MarkdownEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) setDraft(value);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <PencilIcon /> {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <MarkdownEditor value={draft} onChange={setDraft} ariaLabel={title} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(draft);
              setOpen(false);
            }}
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
