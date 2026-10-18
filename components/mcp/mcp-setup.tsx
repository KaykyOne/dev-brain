"use client";

import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mcpServerName } from "@/lib/agent/instructions";

import { AgentsInstructions } from "./agents-instructions";
import { InstallSnippets } from "./install-snippets";

const ACCOUNT = "account";

type McpSetupProps = {
  projects: { id: string; name: string; slug: string }[];
  endpoint: string;
};

/** Instalação do MCP e instruções do AGENTS.md para o alvo escolhido: um projeto ou a conta (hub). */
export function McpSetup({ projects, endpoint }: McpSetupProps) {
  const [target, setTarget] = useState(projects[0]?.id ?? ACCOUNT);
  const project = projects.find((item) => item.id === target) ?? null;

  const items = { [ACCOUNT]: "Conta (hub): listar e criar projetos", ...Object.fromEntries(projects.map((item) => [item.id, item.name])) };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Instalação</CardTitle>
          <CardDescription>
            Escolha o alvo e substitua <code className="font-mono">&lt;SEU_TOKEN&gt;</code> por um token criado acima. Ao
            gerar um token, os mesmos comandos aparecem já preenchidos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field className="max-w-md">
            <FieldLabel>Alvo</FieldLabel>
            <Select items={items} value={target} onValueChange={(value) => value && setTarget(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(items).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Servidor: <code className="font-mono">{mcpServerName(project?.slug)}</code>. Um servidor por projeto, mais
              um de conta.
            </FieldDescription>
          </Field>
          <InstallSnippets endpoint={endpoint} projectSlug={project?.slug} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instruções para o AGENTS.md</CardTitle>
          <CardDescription>
            O agente só é obrigado a seguir o que está no <code className="font-mono">AGENTS.md</code>. Cole este texto
            no arquivo do projeto de código para tornar o uso do MCP obrigatório.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {project ? (
            <AgentsInstructions name={project.name} slug={project.slug} />
          ) : (
            <p className="text-sm text-muted-foreground">
              O texto é gerado por projeto. Escolha um projeto em <strong>Alvo</strong> acima
              {projects.length === 0 ? " (crie um projeto primeiro)" : ""}.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
