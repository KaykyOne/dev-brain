"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { mcpServerName, tokenEnvVar } from "@/lib/agent/instructions";

import { CopyButton } from "./copy-button";

function Snippet({ title, hint, code }: { title: string; hint?: string; code: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <CopyButton value={code} />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

type InstallSnippetsProps = {
  endpoint: string;
  token?: string;
  /** Slug do projeto do token. Ausente = token de conta (hub). */
  projectSlug?: string | null;
};

export function InstallSnippets({ endpoint, token, projectSlug }: InstallSnippetsProps) {
  const value = token ?? "<SEU_TOKEN>";
  const server = mcpServerName(projectSlug);
  const tokenVar = tokenEnvVar(projectSlug);
  const isProject = !!projectSlug;

  // Token de projeto só vale em uma pasta (escopo local, o padrão do Claude Code); o de conta vale em todas.
  const scope = isProject ? "" : "--scope user ";
  const claudeCommand = `claude mcp add --transport http ${scope}${server} ${endpoint} \\\n  --header "Authorization: Bearer ${value}"`;

  const mcpJson = JSON.stringify(
    { mcpServers: { [server]: { type: "http", url: endpoint, headers: { Authorization: `Bearer \${${tokenVar}}` } } } },
    null,
    2,
  );

  const codexEnv = `export ${tokenVar}="${value}"`;
  const codexConfig = `[mcp_servers.${server}]\nurl = "${endpoint}"\nbearer_token_env_var = "${tokenVar}"`;

  return (
    <Tabs defaultValue="claude">
      <TabsList>
        <TabsTrigger value="claude">Claude Code</TabsTrigger>
        <TabsTrigger value="codex">Codex</TabsTrigger>
      </TabsList>

      <TabsContent value="claude" className="space-y-4 pt-4">
        <Snippet
          title="Adicionar o servidor"
          hint={
            isProject
              ? "Rode no terminal, dentro da pasta do projeto de código: o servidor só fica ativo nessa pasta."
              : "Rode no terminal. O token de conta vale em todos os seus projetos."
          }
          code={claudeCommand}
        />
        {isProject && (
          <Snippet
            title="Ou compartilhe pelo .mcp.json"
            hint={`Na raiz do projeto de código. O token fica na variável ${tokenVar}, e não no arquivo.`}
            code={mcpJson}
          />
        )}
        <Snippet title="Verificar" hint="Dentro do Claude Code, /mcp também mostra o estado." code="claude mcp list" />
      </TabsContent>

      <TabsContent value="codex" className="space-y-4 pt-4">
        <Snippet
          title="Exporte o token"
          hint="Adicione ao ~/.bashrc ou ~/.zshrc para persistir."
          code={codexEnv}
        />
        <Snippet title="Adicione ao ~/.codex/config.toml" code={codexConfig} />
      </TabsContent>
    </Tabs>
  );
}
