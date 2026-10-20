"use client";

import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mcpServerName } from "@/lib/agent/instructions";

import { AgentsInstructions } from "./agents-instructions";
import { InstallSnippets } from "./install-snippets";

const ACCOUNT = "account";

type McpSetupProps = {
  projects: { id: string; name: string; slug: string }[];
  endpoint: string;
  /** Conteúdo renderizado no servidor, encaixado nas abas. */
  tokens: React.ReactNode;
  tokenCount: number;
  tools: React.ReactNode;
};

/** Abas da página MCP: tokens, instalação (alvo: um projeto ou a conta) e instruções do AGENTS.md. */
export function McpSetup({ projects, endpoint, tokens, tokenCount, tools }: McpSetupProps) {
  const [target, setTarget] = useState(projects[0]?.id ?? ACCOUNT);
  const project = projects.find((item) => item.id === target) ?? null;
  // O AGENTS.md é sempre de um projeto: seletor próprio, para não depender do alvo da instalação (que pode ser a conta).
  const [instructionsId, setInstructionsId] = useState(projects[0]?.id ?? "");
  const instructionsProject = projects.find((item) => item.id === instructionsId) ?? null;
  const projectItems = Object.fromEntries(projects.map((item) => [item.id, item.name]));

  const items = {
    [ACCOUNT]: "Conta (hub): listar e criar projetos",
    ...Object.fromEntries(projects.map((item) => [item.id, item.name])),
  };

  return (
    <Tabs defaultValue="tokens">
      <TabsList>
        <TabsTrigger value="tokens">Tokens ({tokenCount})</TabsTrigger>
        <TabsTrigger value="install">Instalação</TabsTrigger>
        <TabsTrigger value="agents">AGENTS.md</TabsTrigger>
      </TabsList>

      <TabsContent value="tokens" className="pt-2">
        {tokens}
      </TabsContent>

      <TabsContent value="install" className="space-y-4 pt-2">
        <Card>
          <CardHeader>
            <CardTitle>Instalação</CardTitle>
            <CardDescription>
              Escolha o alvo e substitua <code className="font-mono">&lt;SEU_TOKEN&gt;</code> por um token criado acima.
              Ao gerar um token, os mesmos comandos aparecem já preenchidos.
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
                Servidor: <code className="font-mono">{mcpServerName(project?.slug)}</code>. Um servidor por projeto,
                mais um de conta.
              </FieldDescription>
            </Field>
            <InstallSnippets endpoint={endpoint} projectSlug={project?.slug} />
          </CardContent>
        </Card>
        {tools}
      </TabsContent>

      <TabsContent value="agents" className="pt-2">
        <Card>
          <CardHeader>
            <CardTitle>Instruções para o AGENTS.md</CardTitle>
            <CardDescription>
              O agente só é obrigado a seguir o que está no <code className="font-mono">AGENTS.md</code>. Cole este
              texto no arquivo do projeto de código para tornar o uso do MCP obrigatório.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">O texto é gerado por projeto. Crie um projeto primeiro.</p>
            ) : (
              <>
                <Field className="max-w-md">
                  <FieldLabel>Projeto</FieldLabel>
                  <Select
                    items={projectItems}
                    value={instructionsId}
                    onValueChange={(value) => value && setInstructionsId(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>O texto e o nome do arquivo usam o projeto escolhido.</FieldDescription>
                </Field>
                {instructionsProject && (
                  <AgentsInstructions name={instructionsProject.name} slug={instructionsProject.slug} />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
