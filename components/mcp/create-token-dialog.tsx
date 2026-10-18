"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { createAgentToken } from "@/lib/agent/actions";
import { ACCOUNT_SCOPES, AGENT_SCOPES, PROJECT_SCOPES, type AgentScope } from "@/lib/agent/scopes";
import {
  ACCOUNT_TARGET,
  agentTokenSchema,
  EXPIRATION_OPTIONS,
  type AgentTokenInput,
} from "@/lib/validations/agent-token";

const PROJECT_DEFAULT_SCOPES: AgentScope[] = ["context:read", "context:write", "changes:propose"];

import { CopyButton } from "./copy-button";
import { InstallSnippets } from "./install-snippets";

type Props = {
  projects: { id: string; name: string }[];
  endpoint: string;
};

export function CreateTokenDialog({ projects, endpoint }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{ token: string; name: string } | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AgentTokenInput>({
    resolver: zodResolver(agentTokenSchema),
    defaultValues: {
      name: "",
      projectId: projects.length === 1 ? projects[0].id : ACCOUNT_TARGET,
      scopes: projects.length === 1 ? PROJECT_DEFAULT_SCOPES : ACCOUNT_SCOPES,
      expiration: "90",
    },
  });

  const projectItems = {
    [ACCOUNT_TARGET]: "Conta (hub): iniciar projetos novos",
    ...Object.fromEntries(projects.map((project) => [project.id, project.name])),
  };
  const target = useWatch({ control, name: "projectId" });
  const availableScopes = target === ACCOUNT_TARGET ? ACCOUNT_SCOPES : PROJECT_SCOPES;

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Fecha o fluxo: o token em claro nunca mais fica disponível.
      setCreated(null);
      reset();
      router.refresh();
    }
  }

  async function onSubmit(values: AgentTokenInput) {
    const result = await createAgentToken(values);

    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) setError(field as keyof AgentTokenInput, { message: messages[0] });
      }
      toast.error(result.error);
      return;
    }

    setCreated({ token: result.data.token, name: result.data.name });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        <PlusIcon /> Novo token
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Token “{created.name}” criado</DialogTitle>
              <DialogDescription>
                Copie agora: por segurança, ele não será exibido novamente.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/50 px-3 py-2 font-mono text-xs">
                {created.token}
              </code>
              <CopyButton value={created.token} />
            </div>
            <InstallSnippets endpoint={endpoint} token={created.token} />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Novo token de acesso</DialogTitle>
              <DialogDescription>
                Token de projeto: lê e grava o repositório de um único projeto. Token de conta: lista e cria projetos
                (para o agente iniciar um repositório novo).
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <FieldGroup>
                <Field data-invalid={!!errors.name}>
                  <FieldLabel htmlFor="token-name">Nome</FieldLabel>
                  <Input
                    id="token-name"
                    placeholder="Claude Code — notebook"
                    aria-invalid={!!errors.name}
                    {...register("name")}
                  />
                  <FieldError errors={[errors.name]} />
                </Field>

                <Field data-invalid={!!errors.projectId}>
                  <FieldLabel>Acesso</FieldLabel>
                  <Controller
                    control={control}
                    name="projectId"
                    render={({ field }) => (
                      <Select
                        items={projectItems}
                        value={field.value || null}
                        onValueChange={(value) => {
                          field.onChange(value);
                          setValue("scopes", value === ACCOUNT_TARGET ? ACCOUNT_SCOPES : PROJECT_DEFAULT_SCOPES, {
                            shouldValidate: true,
                          });
                        }}
                      >
                        <SelectTrigger className="w-full" aria-invalid={!!errors.projectId}>
                          <SelectValue placeholder="Selecione o acesso" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ACCOUNT_TARGET}>{projectItems[ACCOUNT_TARGET]}</SelectItem>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError errors={[errors.projectId]} />
                </Field>

                <Field data-invalid={!!errors.scopes}>
                  <FieldLabel>Escopos</FieldLabel>
                  <Controller
                    control={control}
                    name="scopes"
                    render={({ field }) => (
                      <div className="space-y-2">
                        {availableScopes.map((scope) => (
                          <label key={scope} className="flex items-start gap-2 text-sm">
                            <Checkbox
                              checked={field.value.includes(scope)}
                              onCheckedChange={(checked) =>
                                field.onChange(
                                  checked ? [...field.value, scope] : field.value.filter((item) => item !== scope),
                                )
                              }
                            />
                            <span>
                              <code className="font-mono text-xs">{scope}</code>
                              <span className="block text-xs text-muted-foreground">{AGENT_SCOPES[scope]}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  />
                  <FieldError errors={[errors.scopes as { message?: string } | undefined]} />
                </Field>

                <Field>
                  <FieldLabel>Expiração</FieldLabel>
                  <Controller
                    control={control}
                    name="expiration"
                    render={({ field }) => (
                      <Select items={EXPIRATION_OPTIONS} value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(EXPIRATION_OPTIONS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldDescription>Recomendado: renove tokens periodicamente.</FieldDescription>
                </Field>

                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2Icon className="animate-spin" />}
                  Gerar token
                </Button>
              </FieldGroup>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
