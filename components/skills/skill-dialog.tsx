"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PencilIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSkill, updateSkill } from "@/lib/skills/actions";
import { MarkdownImportButton, type ImportedSkill } from "./markdown-import-button";
import { skillSchema, type SkillInput } from "@/lib/validations/skill";

const UNIVERSAL = "universal";

type SkillDialogProps =
  | {
      mode: "create";
      /** Projeto fixo. `null` = universal. Ignorado quando `projects` é informado. */
      projectId: string | null;
      /** Quando informado, permite escolher o escopo (universal ou um projeto). */
      projects?: { id: string; name: string }[];
    }
  | { mode: "edit"; skill: { id: string } & SkillInput };

export function SkillDialog(props: SkillDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<string>(
    props.mode === "create" ? (props.projectId ?? UNIVERSAL) : UNIVERSAL,
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SkillInput>({
    resolver: zodResolver(skillSchema),
    defaultValues: props.mode === "edit" ? props.skill : { name: "", description: "", content: "" },
  });

  async function onSubmit(values: SkillInput) {
    const result =
      props.mode === "edit"
        ? await updateSkill(props.skill.id, values)
        : await createSkill(scope === UNIVERSAL ? null : scope, values);

    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) setError(field as keyof SkillInput, { message: messages[0] });
      }
      toast.error(result.error);
      return;
    }

    toast.success(props.mode === "edit" ? "Skill atualizada" : "Skill criada");
    setOpen(false);
    if (props.mode === "create") reset();
    router.refresh();
  }

  function onImport([{ name, description, content }]: ImportedSkill[]) {
    if (name) setValue("name", name, { shouldValidate: true });
    if (description) setValue("description", description, { shouldValidate: true });
    setValue("content", content, { shouldValidate: true, shouldDirty: true });
  }

  const scopeItems =
    props.mode === "create" && props.projects
      ? { [UNIVERSAL]: "Universal (todos os projetos)", ...Object.fromEntries(props.projects.map((p) => [p.id, p.name])) }
      : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "edit" ? (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Editar skill" />}>
          <PencilIcon />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <PlusIcon /> Nova skill
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{props.mode === "edit" ? "Editar skill" : "Nova skill"}</DialogTitle>
          <DialogDescription>
            Importe um SKILL.md para preencher tudo de uma vez, ou preencha manualmente. O agente descobre e lê a skill pelo MCP.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <div>
              <MarkdownImportButton onImport={onImport} />
            </div>
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
                <FieldDescription>Universal vale para todos os projetos; ou escolha um projeto.</FieldDescription>
              </Field>
            )}
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="skill-name">Nome</FieldLabel>
              <Input id="skill-name" placeholder="Criar endpoint" aria-invalid={!!errors.name} {...register("name")} />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="skill-description">Quando usar</FieldLabel>
              <Textarea
                id="skill-description"
                rows={3}
                placeholder="Use ao criar uma nova rota de API: valida entrada com Zod e segue o padrão de erros."
                aria-invalid={!!errors.description}
                {...register("description")}
              />
              <FieldDescription>O agente decide usar a skill lendo esta descrição.</FieldDescription>
              <FieldError errors={[errors.description]} />
            </Field>
            <Field data-invalid={!!errors.content}>
              <FieldLabel htmlFor="skill-content">Conteúdo (SKILL.md)</FieldLabel>
              <Textarea
                id="skill-content"
                rows={8}
                className="font-mono text-xs"
                placeholder="Opcional. Importe um arquivo ou cole o Markdown aqui."
                aria-invalid={!!errors.content}
                {...register("content")}
              />
              <FieldError errors={[errors.content]} />
            </Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              {props.mode === "edit" ? "Salvar" : "Criar skill"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
