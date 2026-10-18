"use client";

import { FileUpIcon } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { parseSkillMarkdown, type ParsedSkillMarkdown } from "@/lib/skills/frontmatter";
import { MAX_SKILL_CONTENT } from "@/lib/validations/skill";

export const MAX_IMPORT_FILES = 20;

export type ImportedSkill = ParsedSkillMarkdown & { fileName: string; content: string };

/** Nome de fallback: o do arquivo sem extensão, exceto o genérico "SKILL". */
const nameFromFile = (fileName: string) => {
  const base = fileName.replace(/\.(md|markdown)$/i, "");
  return /^skill$/i.test(base) ? "" : base;
};

/**
 * Seleciona um ou vários arquivos .md (1 arquivo = 1 skill), lê no navegador e devolve o texto com
 * nome/descrição extraídos do frontmatter. Arquivos inválidos são ignorados com um aviso.
 */
export function MarkdownImportButton({
  onImport,
  multiple = false,
  label = multiple ? "Selecionar arquivos .md" : "Importar SKILL.md",
}: {
  onImport: (skills: ImportedSkill[]) => void;
  multiple?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    if (files.length > MAX_IMPORT_FILES) {
      toast.error(`Selecione no máximo ${MAX_IMPORT_FILES} arquivos por vez`);
      return;
    }

    const imported: ImportedSkill[] = [];
    const skipped: string[] = [];

    for (const file of files) {
      if (file.size > MAX_SKILL_CONTENT) {
        skipped.push(`${file.name} (maior que 100 KB)`);
        continue;
      }
      const content = await file.text();
      if (!content.trim() || content.includes("\0")) {
        skipped.push(`${file.name} (vazio ou não é texto)`);
        continue;
      }
      const parsed = parseSkillMarkdown(content);
      imported.push({ ...parsed, name: parsed.name ?? (nameFromFile(file.name) || null), fileName: file.name, content });
    }

    if (skipped.length > 0) toast.error(`Ignorados: ${skipped.join(", ")}`);
    if (imported.length > 0) onImport(imported);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,text/markdown"
        multiple={multiple}
        className="hidden"
        onChange={onChange}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <FileUpIcon /> {label}
      </Button>
    </>
  );
}
