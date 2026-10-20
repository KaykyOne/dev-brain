"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PencilIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { MarkdownEditor } from "@/components/markdown/markdown-editor";
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
import { skillTargetItems } from "@/lib/skills/targets";
import { SKILL_TARGET_UNIVERSAL, skillSchema, type SkillInput } from "@/lib/validations/skill";

type SkillDialogProps =
  | {
      mode: "create";
      /** Destino inicial: "universal", "library" ou o id de um projeto. */
      target: string;
      /** Quando informado, permite escolher o escopo (universal ou um projeto). */
      projects?: { id: string; name: string }[];
    }
  | { mode: "edit"; skill: { id: string } & SkillInput };

export function SkillDialog(props: SkillDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<string>(props.mode === "create" ? props.target : SKILL_TARGET_UNIVERSAL);

  const {
    register,
    control,
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
        : await createSkill(scope, values);

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

  const scopeItems = props.mode === "create" && props.projects ? skillTargetItems(props.projects) : null;

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
      <DialogContent className="sm:max-w-3xl">
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
                <FieldDescription>
                  Universal vale para todos os projetos. Biblioteca é aplicada só aos projetos que você escolher.
                  Ou escolha um projeto.
                </FieldDescription>
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
              <FieldLabel>Conteúdo (SKILL.md)</FieldLabel>
              <Controller
                control={control}
                name="content"
                render={({ field }) => (
                  <MarkdownEditor
                    value={field.value}
                    onChange={field.onChange}
                    ariaLabel="Conteúdo do SKILL.md"
                    invalid={!!errors.content}
                    placeholder="Opcional. Importe um arquivo ou escreva o Markdown aqui."
                  />
                )}
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
