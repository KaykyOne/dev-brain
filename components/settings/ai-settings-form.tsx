"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AI_PROVIDERS, PRESETS } from "@/lib/assistant/config";
import { saveAiSettings } from "@/lib/assistant/settings-actions";
import { aiSettingsSchema, type AiSettingsInput } from "@/lib/validations/ai-settings";

const KEY_LINKS: Partial<Record<AiSettingsInput["provider"], string>> = {
  deepseek: "https://platform.deepseek.com/api_keys",
  openai: "https://platform.openai.com/api-keys",
  openrouter: "https://openrouter.ai/keys",
};

type AiSettingsFormProps = {
  initial: Omit<AiSettingsInput, "apiKey" | "removeApiKey">;
  apiKey: { saved: boolean; hint: string | null };
};

export function AiSettingsForm({ initial, apiKey }: AiSettingsFormProps) {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    setError,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<AiSettingsInput>({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues: { ...initial, apiKey: "", removeApiKey: false },
  });

  const provider = useWatch({ control, name: "provider" });
  const removeApiKey = useWatch({ control, name: "removeApiKey" });
  const preset = PRESETS[provider];
  const keyLink = KEY_LINKS[provider];

  async function onSubmit(values: AiSettingsInput) {
    const result = await saveAiSettings(values);

    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) setError(field as keyof AiSettingsInput, { message: messages[0] });
      }
      toast.error(result.error);
      return;
    }

    toast.success("Configuração do assistente salva");
    // A chave digitada não fica no formulário depois de salva.
    resetField("apiKey");
    resetField("removeApiKey");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-xl">
      <FieldGroup>
        <Field data-invalid={!!errors.provider}>
          <FieldLabel>Provedor</FieldLabel>
          <Controller
            control={control}
            name="provider"
            render={({ field }) => (
              <Select items={AI_PROVIDERS} value={field.value} onValueChange={(value) => value && field.onChange(value)}>
                <SelectTrigger className="w-full" aria-invalid={!!errors.provider}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AI_PROVIDERS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={[errors.provider]} />
        </Field>

        <Field data-invalid={!!errors.apiKey}>
          <FieldLabel htmlFor="ai-api-key">Chave de API</FieldLabel>
          <Input
            id="ai-api-key"
            type="password"
            autoComplete="off"
            disabled={removeApiKey}
            placeholder={apiKey.saved ? `Chave salva (${apiKey.hint ?? "…"}): deixe vazio para manter` : "Cole a chave do provedor"}
            aria-invalid={!!errors.apiKey}
            {...register("apiKey")}
          />
          <FieldDescription>
            Fica cifrada no servidor e nunca vai para o navegador.
            {keyLink && (
              <>
                {" "}
                Crie uma em{" "}
                <a href={keyLink} target="_blank" rel="noreferrer" className="underline">
                  {new URL(keyLink).hostname}
                </a>
                .
              </>
            )}
          </FieldDescription>
          <FieldError errors={[errors.apiKey]} />
          {apiKey.saved && (
            <Controller
              control={control}
              name="removeApiKey"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                  Remover a chave salva (desativa o assistente)
                </label>
              )}
            />
          )}
        </Field>

        <Field data-invalid={!!errors.model}>
          <FieldLabel htmlFor="ai-model">Modelo</FieldLabel>
          <Input
            id="ai-model"
            placeholder={preset.model ?? "ex.: gpt-4.1-mini"}
            aria-invalid={!!errors.model}
            {...register("model")}
          />
          <FieldDescription>
            {preset.model ? `Vazio usa o padrão (${preset.model}).` : "Obrigatório para este provedor."}
          </FieldDescription>
          <FieldError errors={[errors.model]} />
        </Field>

        <Field data-invalid={!!errors.baseUrl}>
          <FieldLabel htmlFor="ai-base-url">URL da API</FieldLabel>
          <Input
            id="ai-base-url"
            type="url"
            placeholder={preset.baseUrl ?? "https://seu-provedor/v1"}
            aria-invalid={!!errors.baseUrl}
            {...register("baseUrl")}
          />
          <FieldDescription>
            {preset.baseUrl
              ? "Vazio usa a do provedor. Preencha só para usar um proxy."
              : "Obrigatória: qualquer API compatível com a de chat completions da OpenAI."}
          </FieldDescription>
          <FieldError errors={[errors.baseUrl]} />
        </Field>

        {provider === "deepseek" && (
          <Controller
            control={control}
            name="thinking"
            render={({ field }) => (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                <span>
                  Modo de raciocínio
                  <span className="block text-xs text-muted-foreground">Respostas mais elaboradas, porém mais lentas e caras.</span>
                </span>
              </label>
            )}
          />
        )}

        <Field data-invalid={!!errors.maxSteps} className="max-w-40">
          <FieldLabel htmlFor="ai-max-steps">Máximo de passos</FieldLabel>
          <Input
            id="ai-max-steps"
            type="number"
            min={1}
            max={30}
            aria-invalid={!!errors.maxSteps}
            {...register("maxSteps", { valueAsNumber: true })}
          />
          <FieldDescription>Rodadas de ações por mensagem (1 a 30).</FieldDescription>
          <FieldError errors={[errors.maxSteps]} />
        </Field>

        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2Icon className="animate-spin" />}
            Salvar
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
