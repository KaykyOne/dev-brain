"use client";

import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useTheme } from "next-themes";
import { useMemo } from "react";

export type CodeEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  minHeight?: string;
  maxHeight?: string;
  onCreate?: (view: EditorView) => void;
};

const baseTheme = EditorView.theme({
  "&": { fontSize: "13px", backgroundColor: "transparent" },
  ".cm-content": { fontFamily: "var(--font-geist-mono), ui-monospace, monospace", padding: "8px 0" },
  ".cm-gutters": { backgroundColor: "transparent", border: "none" },
  "&.cm-focused": { outline: "none" },
});

/** Editor CodeMirror 6 com destaque de sintaxe Markdown. Carregado sob demanda (ver `code-editor-lazy`). */
export default function CodeEditor({
  value,
  onChange,
  readOnly = false,
  placeholder,
  ariaLabel,
  minHeight = "12rem",
  maxHeight = "28rem",
  onCreate,
}: CodeEditorProps) {
  const { resolvedTheme } = useTheme();

  const extensions = useMemo(
    () => [
      markdown(),
      EditorView.lineWrapping,
      baseTheme,
      ...(ariaLabel ? [EditorView.contentAttributes.of({ "aria-label": ariaLabel })] : []),
    ],
    [ariaLabel],
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      editable={!readOnly}
      placeholder={placeholder}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      extensions={extensions}
      minHeight={minHeight}
      maxHeight={maxHeight}
      onCreateEditor={onCreate}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
        autocompletion: false,
      }}
    />
  );
}
