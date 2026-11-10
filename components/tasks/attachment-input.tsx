"use client";

import { FileIcon, PaperclipIcon, XIcon } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { checkAttachments, TASK_ATTACHMENT_LIMITS } from "@/lib/validations/task";

import { formatBytes } from "./task-meta";

export type PendingFile = { id: string; file: File; preview?: string };

/** Nome para imagens coladas da área de transferência, que chegam como "image.png". */
function namePasted(file: File): File {
  if (file.name && file.name !== "image.png") return file;
  const ext = file.type.split("/")[1] || "png";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return new File([file], `print-${stamp}.${ext}`, { type: file.type });
}

/** Lista de anexos com arrastar e soltar, colar imagem (Ctrl+V) e seletor de arquivos. */
export function AttachmentInput({
  value,
  onChange,
  onError,
  pasteTarget,
}: {
  value: PendingFile[];
  onChange: (files: PendingFile[]) => void;
  onError: (message: string | null) => void;
  /** Elemento que recebe Ctrl+V de imagens (ex.: o campo de instruções). */
  pasteTarget?: React.RefObject<HTMLElement | null>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function add(files: File[]) {
    if (files.length === 0) return;
    const next = [
      ...value,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      })),
    ];
    const error = checkAttachments(next.map((item) => ({ name: item.file.name, size: item.file.size })));
    onError(error);
    if (!error) onChange(next);
  }

  function remove(id: string) {
    const item = value.find((file) => file.id === id);
    if (item?.preview) URL.revokeObjectURL(item.preview);
    onError(null);
    onChange(value.filter((file) => file.id !== id));
  }

  const onPaste = useEffectEvent((event: ClipboardEvent) => {
    const files = [...(event.clipboardData?.files ?? [])];
    if (files.length === 0) return;
    event.preventDefault();
    add(files.map(namePasted));
  });

  useEffect(() => {
    const target = pasteTarget?.current;
    if (!target) return;
    const listener = (event: ClipboardEvent) => onPaste(event);
    target.addEventListener("paste", listener);
    return () => target.removeEventListener("paste", listener);
  }, [pasteTarget]);

  return (
    <div className="grid gap-2">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          add([...event.dataTransfer.files]);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center text-sm transition-colors",
          dragging ? "border-ring bg-muted/60" : "bg-muted/20",
        )}
      >
        <PaperclipIcon className="size-4 text-muted-foreground" />
        <p className="text-muted-foreground">
          Arraste arquivos, cole um print nas instruções ou{" "}
          <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => inputRef.current?.click()}>
            escolha do computador
          </button>
        </p>
        <p className="text-xs text-muted-foreground">
          Até {TASK_ATTACHMENT_LIMITS.maxFiles} arquivos, {TASK_ATTACHMENT_LIMITS.maxFileBytes / 1024 / 1024} MB cada
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            add([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
      </div>

      {value.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {value.map(({ id, file, preview }) => (
            <li key={id} className="flex items-center gap-3 rounded-lg border p-2 pr-1">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="size-10 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="grid size-10 shrink-0 place-content-center rounded-md bg-muted">
                  <FileIcon className="size-4 text-muted-foreground" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover ${file.name}`} onClick={() => remove(id)}>
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
