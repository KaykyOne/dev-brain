"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { GlobeIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { MarkdownEditor } from "@/components/markdown/markdown-editor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { promoteSkill } from "@/lib/skills/actions";
import { ProjectChecklist } from "./project-checklist";
import { promoteSkillSchema, type PromoteSkillInput } from "@/lib/validations/skill";

type PromoteSkillDialogProps = {
  skill: { id: string; name: string; description: string; content: string };
  projectName?: string;
  /** Projeto de onde a skill sai: se ela for movida para a biblioteca, ele continua com ela por aplicação. */
  originProjectId?: string;
  /** Todos os projetos, para escolher onde aplicar quando o destino é a biblioteca. */
  projects: { id: string; name: string }[];
};

const TARGETS = {
  universal: "Universal: vale para todos os projetos",
  library: "Biblioteca: aplicar só aos projetos escolhidos",
};

/** Revisa e edita uma skill de projeto antes de promovê-la a universal ou à biblioteca. */
export function PromoteSkillDialog({ skill, projectName, originProjectId, projects }: PromoteSkillDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const initial: PromoteSkillInput = {
    name: skill.name,
    description: skill.description,
    content: skill.content,
    keepOriginal: false,
    target: "universal",
    projectIds: [],
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PromoteSkillInput>({ resolver: zodResolver(promoteSkillSchema), defaultValues: initial });

  const target = useWatch({ control, name: "target" });
  const keepOriginal = useWatch({ control, name: "keepOriginal" });
  const others = projects.filter((project) => project.id !== originProjectId);

  function onOpenChange(next: boolean) {
    setOpen(next);
    // Cada abertura parte da skill atual, sem restos de uma edição cancelada.
    if (next) reset(initial);
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

    toast.success(values.target === "library" ? "Skill enviada para a biblioteca" : "Skill adicionada às universais");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Promover ${skill.name}`} title="Promover: universal ou biblioteca" />}
      >
        <GlobeIcon />
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Promover skill</DialogTitle>
          <DialogDescription>
            {projectName ? `Skill de ${projectName}. ` : ""}Ajuste o que for preciso e escolha o destino: universal (todos
            os projetos) ou biblioteca (só os projetos que você escolher).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel>Destino</FieldLabel>
              <Controller
                control={control}
                name="target"
                render={({ field }) => (
                  <Select items={TARGETS} value={field.value} onValueChange={(value) => value && field.onChange(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TARGETS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

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

            {target === "library" && (
              <Field>
                <FieldLabel>Aplicar também em</FieldLabel>
                <Controller
                  control={control}
                  name="projectIds"
                  render={({ field }) => <ProjectChecklist projects={others} value={field.value} onChange={field.onChange} />}
                />
                <FieldDescription>
                  {keepOriginal
                    ? "A skill também continua no projeto de origem, como cópia própria."
                    : `${projectName ?? "O projeto de origem"} continua com a skill, agora aplicada a partir da biblioteca.`}
                </FieldDescription>
              </Field>
            )}

            <Controller
              control={control}
              name="keepOriginal"
              render={({ field }) => (
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                  <span>
                    Manter também a cópia no projeto
                    <FieldDescription>
                      Desmarcado, a skill é movida: sai do projeto e passa a existir só no destino escolhido.
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
                {target === "library" ? "Enviar para a biblioteca" : "Adicionar às universais"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
