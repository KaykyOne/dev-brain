import type { Metadata } from "next";

import { NotFoundView } from "@/components/shared/not-found-view";

export const metadata: Metadata = { title: "Não encontrado" };

export default function DashboardNotFound() {
  return (
    <NotFoundView
      variant="embedded"
      title="Não encontramos isso"
      description="O projeto ou a página que você procura não existe, foi removido ou pertence a outra conta."
    />
  );
}
