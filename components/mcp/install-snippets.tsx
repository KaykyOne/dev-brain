"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { MCP_SERVER_NAME, TOKEN_ENV_VAR } from "@/lib/agent/instructions";

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
  /** Chave recém-gerada; sem ela os comandos mostram um marcador. */
  token?: string;
};

/** Comandos para instalar o MCP único: uma vez por máquina, vale para todos os projetos. */
export function InstallSnippets({ endpoint, token }: InstallSnippetsProps) {
  const value = token ?? "<SUA_CHAVE>";
  const server = MCP_SERVER_NAME;
  const tokenVar = TOKEN_ENV_VAR;

  // Escopo de usuário: o mesmo servidor atende todas as pastas; o projeto vem do AGENTS.md de cada uma.
  const claudeCommand = `claude mcp add --transport http --scope user ${server} ${endpoint} \\\n  --header "Authorization: Bearer ${value}"`;

  const mcpJson = JSON.stringify(
    { mcpServers: { [server]: { type: "http", url: endpoint, headers: { Authorization: `Bearer \${${tokenVar}}` } } } },
    null,
    2,
  );

  const codexEnv = `export ${tokenVar}="${value}"`;
  const codexCommand = `codex mcp add ${server} --url ${endpoint} \\\n  --bearer-token-env-var ${tokenVar}`;
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
          hint="Rode uma vez no terminal: o servidor vale em todas as pastas. Cada projeto de código diz o seu projeto no AGENTS.md."
          code={claudeCommand}
        />
        <Snippet
          title="Ou pelo .mcp.json"
          hint={`Na raiz de um projeto de código. A chave fica na variável ${tokenVar}, e não no arquivo.`}
          code={mcpJson}
        />
        <Snippet title="Verificar" hint="Dentro do Claude Code, /mcp também mostra o estado." code="claude mcp list" />
      </TabsContent>

      <TabsContent value="codex" className="space-y-4 pt-4">
        <Snippet
          title="Exporte a chave"
          hint="O Codex lê a chave desta variável de ambiente: ele não fica no arquivo. Adicione ao ~/.bashrc ou ~/.zshrc para persistir."
          code={codexEnv}
        />
        <Snippet
          title="Adicionar o servidor"
          hint="Rode no terminal, no mesmo shell em que a variável foi exportada. Grava em ~/.codex/config.toml e vale para o CLI, a extensão de IDE e o app."
          code={codexCommand}
        />
        <Snippet title="Verificar" hint="Dentro do Codex, /mcp também mostra o estado." code={`codex mcp list\ncodex mcp get ${server}`} />
        <Snippet
          title="Ou edite o config.toml"
          hint="Equivalente ao comando, em ~/.codex/config.toml."
          code={codexConfig}
        />
      </TabsContent>
    </Tabs>
  );
}
