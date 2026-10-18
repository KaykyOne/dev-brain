"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { GlobeIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { MarkdownEditor } from "@/components/markdown/markdown-editor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { promoteSkill } from "@/lib/skills/actions";
import { promoteSkillSchema, type PromoteSkillInput } from "@/lib/validations/skill";

type PromoteSkillDialogProps = {
  skill: { id: string; name: string; description: string; content: string };
  projectName?: string;
};

/** Revisa e edita uma skill de projeto antes de adicioná-la às universais. */
export function PromoteSkillDialog({ skill, projectName }: PromoteSkillDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PromoteSkillInput>({
    resolver: zodResolver(promoteSkillSchema),
    defaultValues: { name: skill.name, description: skill.description, content: skill.content, keepOriginal: false },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    // Cada abertura parte da skill atual, sem restos de uma edição cancelada.
    if (next) reset({ name: skill.name, description: skill.description, content: skill.content, keepOriginal: false });
  }

  async function onSubmit(values: PromoteSkillInput) {
    const result = await promoteSkill(skill.id, values);

    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) setError(field as keyof PromoteSkillInput, { message: messages[0] });
      }
      toast.error(result.error);
      return;
    }

    toast.success("Skill adicionada às universais");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Tornar ${skill.name} universal`} title="Tornar universal" />}
      >
        <GlobeIcon />
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Tornar universal</DialogTitle>
          <DialogDescription>
            {projectName ? `Skill de ${projectName}. ` : ""}Ajuste o que for preciso: ao confirmar, ela passa a valer para
            todos os projetos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="promote-name">Nome</FieldLabel>
              <Input id="promote-name" aria-invalid={!!errors.name} {...register("name")} />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="promote-description">Quando usar</FieldLabel>
              <Textarea id="promote-description" rows={2} aria-invalid={!!errors.description} {...register("description")} />
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
                    placeholder="Conteúdo da skill em Markdown"
                  />
                )}
              />
              <FieldError errors={[errors.content]} />
            </Field>

            <Controller
              control={control}
              name="keepOriginal"
              render={({ field }) => (
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                  <span>
                    Manter também no projeto
                    <FieldDescription>
                      Desmarcado, a skill é movida: sai do projeto e fica apenas como universal.
                    </FieldDescription>
                  </span>
                </label>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2Icon className="animate-spin" />}
                Adicionar às universais
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
