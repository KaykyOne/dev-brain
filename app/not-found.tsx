import type { Metadata } from "next";

import { NotFoundView } from "@/components/shared/not-found-view";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col">
      <NotFoundView />
    </main>
  );
}
