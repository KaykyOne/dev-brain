"use client";

import { Loader2Icon, TriangleAlertIcon, UploadIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { importSkills } from "@/lib/skills/actions";
import { slugify } from "@/lib/slug";

import { MarkdownImportButton, MAX_IMPORT_FILES, type ImportedSkill } from "./markdown-import-button";

const UNIVERSAL = "universal";

type Item = Omit<ImportedSkill, "name" | "description"> & { key: string; name: string; description: string };

type Props = {
  /** Projeto fixo. `null` = universal. Ignorado quando `projects` é informado. */
  projectId: string | null;
  /** Quando informado, permite escolher o escopo (universal ou um projeto). */
  projects?: { id: string; name: string }[];
};

export function ImportSkillsDialog({ projectId, projects }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [scope, setScope] = useState<string>(projectId ?? UNIVERSAL);
  const [pending, startTransition] = useTransition();

  const scopeItems = projects
    ? { [UNIVERSAL]: "Universal (todos os projetos)", ...Object.fromEntries(projects.map((p) => [p.id, p.name])) }
    : null;

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setItems([]);
  }

  function addFiles(files: ImportedSkill[]) {
    setItems((current) => [
      ...current,
      ...files.map((file) => ({
        ...file,
        key: crypto.randomUUID(),
        name: file.name ?? "",
        description: file.description ?? "",
      })),
    ]);
  }

  const slugCounts = new Map<string, number>();
  for (const item of items) {
    const slug = slugify(item.name);
    if (slug) slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
  }

  const problem = (item: Item) => {
    const slug = slugify(item.name);
    if (!slug) return "Informe um nome";
    if ((slugCounts.get(slug) ?? 0) > 1) return "Nome repetido na seleção";
    if (!item.description.trim()) return "Sem descrição";
    return null;
  };

  const canImport = items.length > 0 && items.every((item) => !problem(item));

  function onConfirm() {
    startTransition(async () => {
      const payload = items.map(({ name, description, content }) => ({ name, description, content }));
      const result = await importSkills(scope === UNIVERSAL ? null : scope, payload);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const { created, failed } = result.data;
      if (created > 0) toast.success(`${created} ${created === 1 ? "skill importada" : "skills importadas"}`);
      if (failed.length > 0) {
        toast.error(`Não importadas: ${failed.map((f) => `${f.name} (${f.reason})`).join("; ")}`);
      }

      if (failed.length === 0) {
        setOpen(false);
        setItems([]);
      } else {
        // Mantém só o que falhou para o usuário corrigir e tentar de novo.
        const failedNames = new Set(failed.map((f) => f.name));
        setItems((current) => current.filter((item) => failedNames.has(item.name.trim() || "(sem nome)")));
      }
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" />}>
        <UploadIcon /> Importar arquivos
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar skills</DialogTitle>
          <DialogDescription>
            Selecione vários arquivos .md de uma vez: cada arquivo vira uma skill. Nome e descrição são lidos do
            frontmatter; confira antes de importar.
          </DialogDescription>
        </DialogHeader>

        {scopeItems && (
          <Field>
            <FieldLabel>Escopo</FieldLabel>
            <Select items={scopeItems} value={scope} onValueChange={(value) => value && setScope(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(scopeItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>Todas as skills desta importação vão para o mesmo escopo.</FieldDescription>
          </Field>
        )}

        <div className="flex items-center gap-3">
          <MarkdownImportButton multiple onImport={addFiles} />
          <span className="text-xs text-muted-foreground">Até {MAX_IMPORT_FILES} arquivos por seleção, 100 KB cada.</span>
        </div>

        {items.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {items.map((item) => {
              const issue = problem(item);
              return (
                <li key={item.key} className="space-y-2 p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={item.name}
                      aria-label={`Nome da skill de ${item.fileName}`}
                      aria-invalid={!!issue}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((other) => (other.key === item.key ? { ...other, name: event.target.value } : other)),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover ${item.fileName}`}
                      onClick={() => setItems((current) => current.filter((other) => other.key !== item.key))}
                    >
                      <XIcon />
                    </Button>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    <span className="font-mono">{item.fileName}</span> · {item.description || "—"}
                  </p>
                  {issue && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <TriangleAlertIcon className="size-3" /> {issue}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button onClick={onConfirm} disabled={!canImport || pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            {items.length > 1 ? `Importar ${items.length} skills` : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
