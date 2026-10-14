import type { Metadata } from "next";

import { CopyButton } from "@/components/mcp/copy-button";
import { CreateTokenDialog } from "@/components/mcp/create-token-dialog";
import { InstallSnippets } from "@/components/mcp/install-snippets";
import { TokenTable } from "@/components/mcp/token-table";
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">MCP</h1>
          <p className="text-sm text-muted-foreground">
            Conecte o Claude Code, o Codex e outros agentes ao contexto dos seus projetos.
          </p>
        </div>
        <CreateTokenDialog projects={projects.map(({ id, name }) => ({ id, name }))} endpoint={endpoint} />
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Tokens</CardTitle>
          <CardDescription>
            {projects.length === 0
              ? "Crie um projeto primeiro: cada token dá acesso a um único projeto."
              : "Cada token dá acesso a um único projeto e pode ser revogado a qualquer momento."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TokenTable tokens={tokens} now={new Date()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instalação</CardTitle>
          <CardDescription>
            Substitua <code className="font-mono">&lt;SEU_TOKEN&gt;</code> por um token criado acima. Ao gerar um token,
            os mesmos comandos aparecem já preenchidos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InstallSnippets endpoint={endpoint} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ferramentas disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {[
              ["get_project", "Metadados do projeto vinculado ao token"],
              ["list_context_files", "Arquivos de contexto sincronizados (filtro por categoria)"],
              ["list_skills", "Skills universais e específicas do projeto, com descrição e caminho"],
              ["get_skill", "Lê o SKILL.md completo de uma skill pelo slug"],
              ["propose_change", "Propõe alteração em um .md; fica pendente até revisão humana"],
              ["get_change", "Consulta o estado de uma proposta"],
            ].map(([name, description]) => (
              <li key={name} className="flex flex-wrap gap-x-3">
                <code className="font-mono">{name}</code>
                <span className="text-muted-foreground">{description}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
