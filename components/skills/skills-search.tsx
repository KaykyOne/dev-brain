"use client";

import { SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SkillsSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  /** Resultado atual, ex.: "2 de 5". Só aparece com busca ativa. */
  summary?: string;
};

/** Campo de busca de uma seção da página de skills. */
export function SkillsSearch({ value, onChange, placeholder, label, summary }: SkillsSearchProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative w-full sm:max-w-md">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Limpar busca"
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
            onClick={() => onChange("")}
          >
            <XIcon />
          </Button>
        )}
      </div>
      {summary && <span className="text-xs text-muted-foreground">{summary}</span>}
    </div>
  );
}
