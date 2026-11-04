import type { Metadata } from "next";

import { AiSettingsForm } from "@/components/settings/ai-settings-form";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAiSettingsView } from "@/lib/assistant/settings";
import { getCurrentUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const ai = await getAiSettingsView(user.id);

  return (
    <>
      <PageHeader title="Configurações" description="Preferências da conta e integrações do DevBrain." />

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Assistente de IA
            <Badge variant={ai.status.enabled ? "secondary" : "outline"}>{ai.status.enabled ? "Ativo" : "Desativado"}</Badge>
          </CardTitle>
          <CardDescription>
            O chat no canto da tela, que cria skills e projetos e grava contexto. Funciona com qualquer API compatível com
            a da OpenAI.
          </CardDescription>
          {!ai.status.enabled && <p className="text-sm text-muted-foreground">{ai.status.reason}</p>}
          {ai.source === "env" && (
            <p className="text-sm text-muted-foreground">
              Ainda nada foi salvo aqui: os valores abaixo vêm do <code className="font-mono">.env</code> do servidor. Ao
              salvar, esta página passa a valer (a chave do <code className="font-mono">.env</code> é trazida junto se o
              campo ficar vazio).
            </p>
          )}
        </CardHeader>
        <CardContent>
          <AiSettingsForm
            initial={{
              provider: ai.provider,
              model: ai.model,
              baseUrl: ai.baseUrl,
              thinking: ai.thinking,
              maxSteps: ai.maxSteps,
            }}
            apiKey={ai.apiKey}
          />
        </CardContent>
      </Card>
    </>
  );
}
