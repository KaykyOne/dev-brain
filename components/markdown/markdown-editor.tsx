"use client";

import type { EditorView } from "@codemirror/view";
import {
  BoldIcon,
  CodeIcon,
  FileCodeIcon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
} from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatSelection, type FormatAction } from "@/lib/markdown/format";
import { cn } from "@/lib/utils";

import { CodeEditor } from "./code-editor-lazy";
import { MarkdownPreview } from "./markdown-preview";

type Mode = "edit" | "split" | "preview";

const TOOLS: { action: FormatAction; label: string; icon: typeof BoldIcon }[] = [
  { action: "heading", label: "Título", icon: Heading2Icon },
  { action: "bold", label: "Negrito", icon: BoldIcon },
  { action: "italic", label: "Itálico", icon: ItalicIcon },
  { action: "code", label: "Código em linha", icon: CodeIcon },
  { action: "codeblock", label: "Bloco de código", icon: FileCodeIcon },
  { action: "link", label: "Link", icon: LinkIcon },
  { action: "ul", label: "Lista", icon: ListIcon },
  { action: "ol", label: "Lista numerada", icon: ListOrderedIcon },
  { action: "quote", label: "Citação", icon: QuoteIcon },
];

const MODES: { mode: Mode; label: string; className?: string }[] = [
  { mode: "edit", label: "Editar" },
  { mode: "split", label: "Dividido", className: "hidden md:inline-flex" },
  { mode: "preview", label: "Visualizar" },
];

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  invalid?: boolean;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
};

/** Editor Markdown: destaque de sintaxe, barra de formatação e preview lado a lado ou em aba. */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  ariaLabel = "Editor Markdown",
  invalid,
  minHeight = "14rem",
  maxHeight = "26rem",
  className,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<Mode>("edit");
  const viewRef = useRef<EditorView | null>(null);

  function format(action: FormatAction) {
    const view = viewRef.current;
    if (!view) return;

    const { from, to } = view.state.selection.main;
    const edit = formatSelection(view.state.doc.toString(), from, to, action);
    view.dispatch({
      changes: { from: edit.from, to: edit.to, insert: edit.insert },
      selection: { anchor: edit.anchor, head: edit.head },
    });
    view.focus();
  }

  const lines = value ? value.split("\n").length : 0;
  const showEditor = mode !== "preview";
  const showPreview = mode !== "edit";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive ring-3 ring-destructive/20",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Formatação">
          {TOOLS.map(({ action, label, icon: Icon }) => (
            <Button
              key={action}
              type="button"
              variant="ghost"
              size="icon-sm"
              title={label}
              aria-label={label}
              disabled={!showEditor}
              onClick={() => format(action)}
            >
              <Icon />
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5" role="group" aria-label="Modo de exibição">
          {MODES.map(({ mode: option, label, className: modeClass }) => (
            <Button
              key={option}
              type="button"
              size="xs"
              variant={mode === option ? "secondary" : "ghost"}
              aria-pressed={mode === option}
              className={modeClass}
              onClick={() => setMode(option)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className={cn("grid", mode === "split" && "md:grid-cols-2 md:divide-x")}>
        {showEditor && (
          <div className="min-w-0">
            <CodeEditor
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              ariaLabel={ariaLabel}
              minHeight={minHeight}
              maxHeight={maxHeight}
              onCreate={(view) => {
                viewRef.current = view;
              }}
            />
          </div>
        )}
        {showPreview && (
          <div className="min-w-0 overflow-auto p-4" style={{ minHeight, maxHeight }}>
            <MarkdownPreview source={value} />
          </div>
        )}
      </div>

      <div className="border-t bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
        {lines} {lines === 1 ? "linha" : "linhas"} · {value.length} caracteres
      </div>
    </div>
  );
}
