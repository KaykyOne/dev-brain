"use client";

import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Baixa um texto como arquivo, sem passar pelo servidor. */
export function DownloadButton({
  filename,
  content,
  label = "Baixar .md",
}: {
  filename: string;
  content: string;
  label?: string;
}) {
  function download() {
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={download}>
      <DownloadIcon /> {label}
    </Button>
  );
}
