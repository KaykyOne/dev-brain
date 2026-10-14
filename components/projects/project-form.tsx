"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createProject, updateProject } from "@/lib/projects/actions";
import { slugify } from "@/lib/slug";
import { MarkdownImportButton } from "@/components/skills/markdown-import-button";
import { Badge } from "@/components/ui/badge";
import { createProjectSchema, type CreateProjectInput, type ProjectInput } from "@/lib/validations/project";

const DEFAULT_PATH_ROOT = "devbrain/projects";

type ProjectFormProps = {
  /** Quando informado, o formulário edita o projeto; caso contrário, cria um novo. */
  project?: { id: string } & ProjectInput;
  /** Skills universais, exibidas no cadastro como já incluídas. */
  universalSkills?: { id: string; name: string }[];
};

export function ProjectForm({ project, universalSkills = [] }: ProjectFormProps) {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      repositoryPath: "",
      defaultBranch: "main",
      ...project,
      skills: [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "skills" });
  const skillRows = useWatch({ control, name: "skills" });

  async function onSubmit(values: CreateProjectInput) {
    const result = project ? await updateProject(project.id, values) : await createProject(values);

    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) setError(field as keyof CreateProjectInput, { message: messages[0] });
      }
      toast.error(result.error);
      return;
    }

    toast.success(project ? "Projeto atualizado" : "Projeto criado");
    router.push(`/projects/${result.data.slug}`);
    router.refresh();
  }

  const nameField = register("name");
  const slugField = register("slug");

  /** Sugere o caminho no repositório a partir do slug, enquanto não for editado manualmente. */
  function suggestPath(slug: string) {
    if (project || dirtyFields.repositoryPath) return;
    setValue("repositoryPath", slug ? `${DEFAULT_PATH_ROOT}/${slug}` : "");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-xl">
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Nome</FieldLabel>
          <Input
            id="name"
            aria-invalid={!!errors.name}
            {...nameField}
            onChange={(event) => {
              void nameField.onChange(event);
              if (!project && !dirtyFields.slug) {
                const slug = slugify(event.target.value);
                setValue("slug", slug, { shouldValidate: true });
                suggestPath(slug);
              }
            }}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field data-invalid={!!errors.slug}>
          <FieldLabel htmlFor="slug">Slug</FieldLabel>
          <Input
            id="slug"
            aria-invalid={!!errors.slug}
            {...slugField}
            onChange={(event) => {
              void slugField.onChange(event);
              suggestPath(event.target.value.trim());
            }}
          />
          <FieldDescription>Identificador único usado na URL e nas integrações.</FieldDescription>
          <FieldError errors={[errors.slug]} />
        </Field>

        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="description">Descrição</FieldLabel>
          <Textarea id="description" rows={3} aria-invalid={!!errors.description} {...register("description")} />
          <FieldError errors={[errors.description]} />
        </Field>

        <Field data-invalid={!!errors.repositoryPath}>
          <FieldLabel htmlFor="repositoryPath">Caminho no repositório</FieldLabel>
          <Input
            id="repositoryPath"
            placeholder={`${DEFAULT_PATH_ROOT}/meu-projeto`}
            aria-invalid={!!errors.repositoryPath}
            {...register("repositoryPath")}
          />
          <FieldDescription>
            Preenchido a partir do slug; edite se o seu repositório usar outra pasta.
          </FieldDescription>
          <FieldError errors={[errors.repositoryPath]} />
        </Field>

        <Field data-invalid={!!errors.defaultBranch}>
          <FieldLabel htmlFor="defaultBranch">Branch principal</FieldLabel>
          <Input id="defaultBranch" aria-invalid={!!errors.defaultBranch} {...register("defaultBranch")} />
          <FieldError errors={[errors.defaultBranch]} />
        </Field>

        {!project && (
          <FieldSet>
            <FieldLegend>Skills</FieldLegend>
            <FieldDescription>
              Skills universais valem automaticamente. Aqui você adiciona as específicas deste projeto.
            </FieldDescription>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Universais (já incluídas)</p>
              {universalSkills.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma skill universal criada ainda.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {universalSkills.map((skill) => (
                    <Badge key={skill.id} variant="secondary">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Específicas deste projeto</p>
              {fields.map((field, index) => (
                <div key={field.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-start gap-2">
                    <Field data-invalid={!!errors.skills?.[index]?.name} className="flex-1">
                      <Input
                        placeholder="Nome (ex.: Criar migration)"
                        aria-label={`Nome da skill ${index + 1}`}
                        aria-invalid={!!errors.skills?.[index]?.name}
                        {...register(`skills.${index}.name`)}
                      />
                      <FieldError errors={[errors.skills?.[index]?.name]} />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover skill ${index + 1}`}
                      onClick={() => remove(index)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <MarkdownImportButton
                      onImport={([{ name, description, content }]) => {
                        if (name) setValue(`skills.${index}.name`, name, { shouldValidate: true });
                        if (description) setValue(`skills.${index}.description`, description, { shouldValidate: true });
                        setValue(`skills.${index}.content`, content, { shouldValidate: true });
                      }}
                    />
                    {skillRows[index]?.content && (
                      <span className="text-xs text-muted-foreground">
                        SKILL.md anexado · {skillRows[index].content.split("\n").length} linhas
                      </span>
                    )}
                  </div>
                  <FieldError errors={[errors.skills?.[index]?.content]} />
                  <Field data-invalid={!!errors.skills?.[index]?.description}>
                    <Textarea
                      rows={2}
                      placeholder="Quando usar (o agente lê isto para decidir)"
                      aria-label={`Descrição da skill ${index + 1}`}
                      aria-invalid={!!errors.skills?.[index]?.description}
                      {...register(`skills.${index}.description`)}
                    />
                    <FieldError errors={[errors.skills?.[index]?.description]} />
                  </Field>
                </div>
              ))}
              <FieldError errors={[errors.skills?.root ?? (errors.skills as { message?: string } | undefined)]} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", description: "", content: "" })}>
                  <PlusIcon /> Adicionar skill
                </Button>
                <MarkdownImportButton
                  multiple
                  label="Importar vários .md"
                  onImport={(files) =>
                    append(
                      files.map((file) => ({
                        name: file.name ?? "",
                        description: file.description ?? "",
                        content: file.content,
                      })),
                    )
                  }
                />
              </div>
            </div>
          </FieldSet>
        )}

        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2Icon className="animate-spin" />}
            {project ? "Salvar alterações" : "Criar projeto"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
