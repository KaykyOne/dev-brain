"use client";

import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MCP_SERVER_NAME } from "@/lib/agent/instructions";

import { AgentsInstructions } from "./agents-instructions";
import { InstallSnippets } from "./install-snippets";

type McpSetupProps = {
  projects: { id: string; name: string; slug: string; active: boolean }[];
  endpoint: string;
  /** Conteúdo renderizado no servidor, encaixado nas abas. */
  projectList: React.ReactNode;
  accessKey: React.ReactNode;
  tools: React.ReactNode;
};

/** Abas da página MCP: projetos acessíveis, instalação (chave única) e instruções do AGENTS.md. */
export function McpSetup({ projects, endpoint, projectList, accessKey, tools }: McpSetupProps) {
  // O AGENTS.md é o que diz ao agente qual projeto usar: um texto por projeto.
  const [instructionsId, setInstructionsId] = useState(projects[0]?.id ?? "");
  const instructionsProject = projects.find((item) => item.id === instructionsId) ?? null;
  const projectItems = Object.fromEntries(projects.map((item) => [item.id, item.name]));
  const activeCount = projects.filter((item) => item.active).length;

  return (
    <Tabs defaultValue="projects">
      <TabsList>
        <TabsTrigger value="projects">
          Projetos ({activeCount}/{projects.length})
        </TabsTrigger>
        <TabsTrigger value="install">Instalação</TabsTrigger>
        <TabsTrigger value="agents">AGENTS.md</TabsTrigger>
      </TabsList>

      <TabsContent value="projects" className="pt-2">
        <Card>
          <CardHeader>
            <CardTitle>Projetos acessíveis pelo MCP</CardTitle>
            <CardDescription>
              Um único servidor <code className="font-mono">{MCP_SERVER_NAME}</code> atende todos os projetos. Só os
              ativos respondem; num desativado o agente é avisado para pedir a reativação.
            </CardDescription>
          </CardHeader>
          <CardContent>{projectList}</CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="install" className="space-y-4 pt-2">
        {accessKey}
        <Card>
          <CardHeader>
            <CardTitle>Instalação</CardTitle>
            <CardDescription>
              Uma vez por máquina. Substitua <code className="font-mono">&lt;SUA_CHAVE&gt;</code> pela chave de acesso;
              ao gerar uma chave, os mesmos comandos aparecem já preenchidos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InstallSnippets endpoint={endpoint} />
          </CardContent>
        </Card>
        {tools}
      </TabsContent>

      <TabsContent value="agents" className="pt-2">
        <Card>
          <CardHeader>
            <CardTitle>Instruções para o AGENTS.md</CardTitle>
            <CardDescription>
              É o <code className="font-mono">AGENTS.md</code> do projeto de código que diz ao agente qual projeto do
              DevBrain usar, e torna o uso do MCP obrigatório. Cole este texto nele.
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
