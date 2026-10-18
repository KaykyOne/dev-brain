"use client";

import { MarkdownViewer } from "@/components/markdown/markdown-viewer";
import { buildAgentsInstructions, instructionsFileName } from "@/lib/agent/instructions";

import { CopyButton } from "./copy-button";
import { DownloadButton } from "./download-button";

/** Texto para colar no AGENTS.md do projeto de código e obrigar o uso do MCP, com copiar e baixar. */
export function AgentsInstructions({ name, slug }: { name: string; slug: string }) {
  const text = buildAgentsInstructions({ name, slug });

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton value={text} label="Copiar texto" />
        <DownloadButton filename={instructionsFileName(slug)} content={text} />
        <span className="font-mono text-xs text-muted-foreground">{instructionsFileName(slug)}</span>
      </div>
      <MarkdownViewer source={text} />
    </div>
  );
}
