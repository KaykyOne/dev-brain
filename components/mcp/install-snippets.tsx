"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CopyButton } from "./copy-button";

const SERVER_NAME = "devbrain";
const TOKEN_VAR = "DEVBRAIN_TOKEN";

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

export function InstallSnippets({ endpoint, token }: { endpoint: string; token?: string }) {
  const value = token ?? "<SEU_TOKEN>";

  const claudeCommand = `claude mcp add --transport http --scope user ${SERVER_NAME} ${endpoint} \\\n  --header "Authorization: Bearer ${value}"`;

  const codexEnv = `export ${TOKEN_VAR}="${value}"`;
  const codexConfig = `[mcp_servers.${SERVER_NAME}]\nurl = "${endpoint}"\nbearer_token_env_var = "${TOKEN_VAR}"`;

  return (
    <Tabs defaultValue="claude">
      <TabsList>
        <TabsTrigger value="claude">Claude Code</TabsTrigger>
        <TabsTrigger value="codex">Codex</TabsTrigger>
      </TabsList>

      <TabsContent value="claude" className="space-y-4 pt-4">
        <Snippet
          title="Adicionar o servidor"
          hint="Rode no terminal. Use --scope project para compartilhar via .mcp.json (nesse caso, prefira uma variável de ambiente no header)."
          code={claudeCommand}
        />
        <Snippet title="Verificar" hint="Dentro do Claude Code, /mcp também mostra o estado." code="claude mcp list" />
      </TabsContent>

      <TabsContent value="codex" className="space-y-4 pt-4">
        <Snippet
          title="1. Exporte o token"
          hint="Adicione ao ~/.bashrc ou ~/.zshrc para persistir."
          code={codexEnv}
        />
        <Snippet title="2. Adicione ao ~/.codex/config.toml" code={codexConfig} />
      </TabsContent>
    </Tabs>
  );
}
