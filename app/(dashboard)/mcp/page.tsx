import type { Metadata } from "next";

import { AccessKeyCard } from "@/components/mcp/access-key-card";
import { CopyButton } from "@/components/mcp/copy-button";
import { McpProjects } from "@/components/mcp/mcp-projects";
import { McpSetup } from "@/components/mcp/mcp-setup";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessKeyStatus } from "@/lib/agent/queries";
import { getCurrentUser } from "@/lib/auth/dal";
import { env } from "@/lib/env";
import { listProjects } from "@/lib/projects/queries";

export const metadata: Metadata = { title: "MCP" };

export default async function McpPage() {
  const user = await getCurrentUser();
  const [rows, access] = await Promise.all([listProjects(user.id), getAccessKeyStatus(user.id)]);
  const projects = rows.map(({ id, name, slug, active }) => ({ id, name, slug, active }));

  const endpoint = `${env.APP_URL}/api/mcp`;

  return (
    <>
      <PageHeader
        title="MCP"
        description="Um servidor MCP para todos os projetos: o AGENTS.md de cada projeto de código diz qual contexto usar."
      />

      <Card>
        <CardHeader>
          <CardTitle>Endpoint</CardTitle>
          <CardDescription>Servidor MCP (Streamable HTTP). Autenticação pela chave de acesso (Bearer).</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/50 px-3 py-2 font-mono text-sm">
            {endpoint}
          </code>
          <CopyButton value={endpoint} />
        </CardContent>
      </Card>

      <McpSetup
        projects={projects}
        endpoint={endpoint}
        projectList={<McpProjects projects={projects} />}
        accessKey={
          <AccessKeyCard
            endpoint={endpoint}
            current={access.key}
            activeCount={access.activeCount}
            legacyCount={access.legacyCount}
          />
        }
        tools={
          <Card>
            <CardHeader>
              <CardTitle>Ferramentas disponíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                {[
                  [
                    "Hub",
                    [
                      ["list_projects", "Lista os projetos da conta, com slug e se está ativo"],
                      ["create_project", "Inicia um projeto novo: cria o repositório git no padrão do hub, já ativo"],
                    ],
                  ],
                  [
                    "Por projeto (argumento project: slug)",
                    [
                      ["get_project", "Metadados do projeto e estado do repositório (commits, último commit)"],
                      ["list_context_files", "Arquivos versionados no repositório (filtro por pasta)"],
                      ["read_context_file", "Lê um arquivo do repositório (README.md, 00-base.md, skills/...)"],
                      ["write_context_file", "Grava um arquivo e faz um commit local só com ele (nunca há push)"],
                      ["repo_log", "Últimos commits do repositório"],
                      ["list_skills / get_skill", "Skills cadastradas no DevBrain (universais, da biblioteca aplicadas ao projeto e do próprio projeto)"],
                      ["propose_change / get_change", "Propõe alteração para revisão humana; fica pendente até aprovação"],
                    ],
                  ],
                ].map(([title, tools]) => (
                  <div key={title as string} className="space-y-2">
                    <p className="font-medium">{title as string}</p>
                    <ul className="space-y-2">
                      {(tools as string[][]).map(([name, description]) => (
                        <li key={name} className="flex flex-wrap gap-x-3">
                          <code className="font-mono">{name}</code>
                          <span className="text-muted-foreground">{description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        }
      />
    </>
  );
}
