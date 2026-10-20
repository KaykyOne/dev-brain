import type { Metadata } from "next";

import { CopyButton } from "@/components/mcp/copy-button";
import { CreateTokenDialog } from "@/components/mcp/create-token-dialog";
import { McpSetup } from "@/components/mcp/mcp-setup";
import { TokenTable } from "@/components/mcp/token-table";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listAgentTokens } from "@/lib/agent/queries";
import { getCurrentUser } from "@/lib/auth/dal";
import { env } from "@/lib/env";
import { listProjects } from "@/lib/projects/queries";

export const metadata: Metadata = { title: "MCP" };

export default async function McpPage() {
  const user = await getCurrentUser();
  const [projects, tokens] = await Promise.all([listProjects(user.id), listAgentTokens(user.id)]);

  const endpoint = `${env.APP_URL}/api/mcp`;

  return (
    <>
      <PageHeader
        title="MCP"
        description="Conecte o Claude Code, o Codex e outros agentes aos repositórios de contexto do hub."
        actions={<CreateTokenDialog projects={projects.map(({ id, name }) => ({ id, name }))} endpoint={endpoint} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Endpoint</CardTitle>
          <CardDescription>Servidor MCP (Streamable HTTP). Autenticação por token Bearer.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/50 px-3 py-2 font-mono text-sm">
            {endpoint}
          </code>
          <CopyButton value={endpoint} />
        </CardContent>
      </Card>

      <McpSetup
        projects={projects.map(({ id, name, slug }) => ({ id, name, slug }))}
        endpoint={endpoint}
        tokenCount={tokens.length}
        tokens={
          <Card>
            <CardHeader>
              <CardTitle>Tokens</CardTitle>
              <CardDescription>
                Token de projeto dá acesso a um único repositório; token de conta (hub) só lista e cria projetos. Ambos
                podem ser revogados a qualquer momento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TokenTable tokens={tokens} now={new Date()} />
            </CardContent>
          </Card>
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
                    "Token de conta (hub)",
                    [
                      ["list_projects", "Lista os projetos (repositórios de contexto) da conta"],
                      ["create_project", "Inicia um projeto novo: cria o repositório git no padrão do hub e, se quiser, já emite o token dele"],
                    ],
                  ],
                  [
                    "Token de projeto",
                    [
                      ["get_project", "Metadados do projeto e estado do repositório (commits, último commit)"],
                      ["list_context_files", "Arquivos versionados no repositório (filtro por pasta)"],
                      ["read_context_file", "Lê um arquivo do repositório (README.md, 00-base.md, skills/...)"],
                      ["write_context_file", "Grava um arquivo e faz um commit local só com ele (escopo context:write; nunca há push)"],
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
