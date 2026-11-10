"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { GitBranchIcon, Loader2Icon, PlusIcon, SparklesIcon, TerminalIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiUrl } from "@/lib/api-url";
import { cn } from "@/lib/utils";
import { createTaskSchema, MODEL_SUGGESTIONS, type CreateTaskInput } from "@/lib/validations/task";

import { AttachmentInput, type PendingFile } from "./attachment-input";

export type TaskProject = { slug: string; name: string; defaultBranch: string; active: boolean };

const AGENTS = [
  { value: "claude", label: "Claude Code", description: "Anthropic · claude -p", icon: SparklesIcon },
  { value: "codex", label: "Codex", description: "OpenAI · codex exec", icon: TerminalIcon },
] as const;

export function NewTaskDialog({ projects, defaultProject }: { projects: TaskProject[]; defaultProject?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  const activeProjects = projects.filter((p) => p.active);
  const initialProject = activeProjects.find((p) => p.slug === defaultProject) ?? activeProjects[0];

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      project: initialProject?.slug ?? "",
      title: "",
      prompt: "",
      agent: "claude",
      branchMode: "new",
      branch: "",
      baseBranch: initialProject?.defaultBranch ?? "",
      planModel: "",
      execModel: "",
      planFirst: false,
    },
  });

  const branchMode = useWatch({ control, name: "branchMode" });
  const agent = useWatch({ control, name: "agent" }) ?? "claude";
  const suggestions = MODEL_SUGGESTIONS[agent];
  const projectItems = Object.fromEntries(activeProjects.map((p) => [p.slug, p.name]));
  const { ref: promptFieldRef, ...promptField } = register("prompt");

  async function onSubmit(values: CreateTaskInput) {
    if (fileError) return;
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, String(value ?? ""));
    for (const { file } of files) form.append("attachments", file, file.name);

    const response = await fetch(apiUrl("/api/tasks"), { method: "POST", body: form });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

    if (!response.ok) {
      for (const [field, messages] of Object.entries(body.fieldErrors ?? {})) {
        if (!messages?.[0]) continue;
        if (field === "attachments") setFileError(messages[0]);
        else setError(field as keyof CreateTaskInput, { message: messages[0] });
      }
      toast.error(body.error ?? "Não foi possível cadastrar a tarefa");
      return;
    }

    toast.success("Tarefa adicionada à fila", {
      description: "A extensão Agent Tasks do VS Code executa assim que estiver com o projeto aberto.",
    });
    files.forEach((item) => item.preview && URL.revokeObjectURL(item.preview));
    setFiles([]);
    reset({ ...values, title: "", prompt: "", branch: "", planFirst: false });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button disabled={activeProjects.length === 0} />}>
        <PlusIcon /> Nova tarefa
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>
            O agente executa no seu computador, pela extensão Agent Tasks do VS Code, numa branch própria. Você recebe
            uma notificação quando terminar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.project}>
              <FieldLabel>Projeto</FieldLabel>
              <Controller
                control={control}
                name="project"
                render={({ field }) => (
                  <Select
                    items={projectItems}
                    value={field.value}
                    onValueChange={(value) => {
                      if (!value) return;
                      field.onChange(value);
                      const project = activeProjects.find((p) => p.slug === value);
                      if (project) setValue("baseBranch", project.defaultBranch);
                    }}
                  >
                    <SelectTrigger className="w-full" aria-invalid={!!errors.project}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activeProjects.map((project) => (
                        <SelectItem key={project.slug} value={project.slug}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.project]} />
            </Field>

            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="task-title">Título</FieldLabel>
              <Input
                id="task-title"
                placeholder="Adicionar paginação na lista de pedidos"
                aria-invalid={!!errors.title}
                {...register("title")}
              />
              <FieldError errors={[errors.title]} />
            </Field>

            <Field data-invalid={!!errors.prompt}>
              <FieldLabel htmlFor="task-prompt">Instruções</FieldLabel>
              <Textarea
                id="task-prompt"
                rows={7}
                placeholder="Descreva o que precisa ser feito: arquivos envolvidos, critérios de pronto, como testar..."
                aria-invalid={!!errors.prompt}
                className="max-h-[40svh]"
                {...promptField}
                ref={(element) => {
                  promptFieldRef(element);
                  promptRef.current = element;
                }}
              />
              <FieldDescription>Seja específico. O agente roda sem ninguém acompanhando e não pode fazer perguntas.</FieldDescription>
              <FieldError errors={[errors.prompt]} />
            </Field>

            <Field data-invalid={!!fileError}>
              <FieldLabel>Anexos</FieldLabel>
              <AttachmentInput value={files} onChange={setFiles} onError={setFileError} pasteTarget={promptRef} />
              {fileError && <FieldError>{fileError}</FieldError>}
            </Field>

            <Field>
              <FieldLabel>Agente</FieldLabel>
              <Controller
                control={control}
                name="agent"
                render={({ field }) => (
                  <div role="radiogroup" aria-label="Agente" className="grid gap-3 sm:grid-cols-2">
                    {AGENTS.map((agent) => {
                      const checked = field.value === agent.value;
                      return (
                        <button
                          key={agent.value}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          onClick={() => {
                            if (agent.value !== field.value) {
                              setValue("planModel", "");
                              setValue("execModel", "");
                            }
                            field.onChange(agent.value);
                          }}
                          className={cn(
                            "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                            checked && "border-primary bg-primary/5",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-8 shrink-0 place-content-center rounded-md bg-muted",
                              checked && "bg-primary text-primary-foreground",
                            )}
                          >
                            <agent.icon className="size-4" />
                          </span>
                          <span>
                            <span className="block text-sm font-medium">{agent.label}</span>
                            <span className="block text-xs text-muted-foreground">{agent.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field data-invalid={!!errors.planModel}>
                <FieldLabel htmlFor="task-plan-model">Modelo de planejamento</FieldLabel>
                <Input
                  id="task-plan-model"
                  list="task-model-suggestions"
                  placeholder="padrão da CLI"
                  className="font-mono"
                  aria-invalid={!!errors.planModel}
                  {...register("planModel")}
                />
                <FieldError errors={[errors.planModel]} />
              </Field>
              <Field data-invalid={!!errors.execModel}>
                <FieldLabel htmlFor="task-exec-model">Modelo de execução</FieldLabel>
                <Input
                  id="task-exec-model"
                  list="task-model-suggestions"
                  placeholder="padrão da CLI"
                  className="font-mono"
                  aria-invalid={!!errors.execModel}
                  {...register("execModel")}
                />
                <FieldError errors={[errors.execModel]} />
              </Field>
              <datalist id="task-model-suggestions">
                {suggestions.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </div>

            <Controller
              control={control}
              name="planFirst"
              render={({ field }) => (
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <Checkbox className="mt-0.5" checked={!!field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                  <span>
                    <span className="block font-medium">Planejar antes de executar</span>
                    <span className="block text-muted-foreground">
                      O modelo de planejamento lê o código e escreve um plano, sem alterar arquivos. Depois o de execução
                      implementa seguindo o plano. Use um modelo forte para planejar e um mais barato para executar.
                    </span>
                  </span>
                </label>
              )}
            />

            <Field>
              <FieldLabel>Branch</FieldLabel>
              <Controller
                control={control}
                name="branchMode"
                render={({ field }) => (
                  <Tabs value={field.value} onValueChange={(value) => field.onChange(value)}>
                    <TabsList>
                      <TabsTrigger value="new">
                        <PlusIcon /> Nova branch
                      </TabsTrigger>
                      <TabsTrigger value="existing">
                        <GitBranchIcon /> Branch existente
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              />
              {branchMode === "existing" ? (
                <Field data-invalid={!!errors.branch}>
                  <Input placeholder="feat/minha-branch" className="font-mono" aria-invalid={!!errors.branch} aria-label="Nome da branch" {...register("branch")} />
                  <FieldDescription>Se ela existir só no remoto, a extensão cria a branch local rastreando a remota.</FieldDescription>
                  <FieldError errors={[errors.branch]} />
                </Field>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field data-invalid={!!errors.branch}>
                    <FieldLabel htmlFor="task-branch" className="font-normal text-muted-foreground">
                      Nome (opcional)
                    </FieldLabel>
                    <Input id="task-branch" placeholder="A IA escolhe" className="font-mono" aria-invalid={!!errors.branch} {...register("branch")} />
                    <FieldError errors={[errors.branch]} />
                  </Field>
                  <Field data-invalid={!!errors.baseBranch}>
                    <FieldLabel htmlFor="task-base" className="font-normal text-muted-foreground">
                      A partir de
                    </FieldLabel>
                    <Input id="task-base" placeholder="branch atual" className="font-mono" aria-invalid={!!errors.baseBranch} {...register("baseBranch")} />
                    <FieldError errors={[errors.baseBranch]} />
                  </Field>
                </div>
              )}
            </Field>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
              Adicionar à fila
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
