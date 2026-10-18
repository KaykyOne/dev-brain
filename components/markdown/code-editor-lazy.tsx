"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

/** O CodeMirror é pesado: só carrega no navegador, quando um editor realmente aparece. */
export const CodeEditor = dynamic(() => import("./code-editor"), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full rounded-none" />,
});
