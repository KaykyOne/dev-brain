"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CodeEditor } from "./code-editor-lazy";
import { MarkdownPreview } from "./markdown-preview";

/** Visualização somente leitura de um Markdown: renderizado ou código-fonte com destaque. */
export function MarkdownViewer({ source, className }: { source: string; className?: string }) {
  const [mode, setMode] = useState<"preview" | "source">("preview");

  return (
    <div className={cn("overflow-hidden rounded-lg border", className)}>
      <div className="flex items-center gap-0.5 border-b bg-muted/40 p-1.5" role="group" aria-label="Modo de exibição">
        {(
          [
            ["preview", "Visualizar"],
            ["source", "Código"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="xs"
            variant={mode === value ? "secondary" : "ghost"}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {mode === "preview" ? (
        <div className="max-h-[32rem] overflow-auto p-4">
          <MarkdownPreview source={source} />
        </div>
      ) : (
        <CodeEditor value={source} readOnly ariaLabel="Código-fonte Markdown" minHeight="8rem" maxHeight="32rem" />
      )}
    </div>
  );
}
