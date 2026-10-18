"use client";

import { EyeIcon } from "lucide-react";

import { MarkdownViewer } from "@/components/markdown/markdown-viewer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type SkillViewDialogProps = { name: string; description: string; path: string; content: string | null };

/** Mostra o SKILL.md armazenado, renderizado ou como código. */
export function SkillViewDialog({ name, description, path, content }: SkillViewDialogProps) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Ver ${name}`} title="Ver SKILL.md" />}>
        <EyeIcon />
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          <p className="truncate font-mono text-xs text-muted-foreground">{path}</p>
        </DialogHeader>
        {content ? (
          <MarkdownViewer source={content} />
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Esta skill ainda não tem um SKILL.md. Edite-a para adicionar o conteúdo.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
