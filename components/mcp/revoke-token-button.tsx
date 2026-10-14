"use client";

import { BanIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { revokeAgentToken } from "@/lib/agent/actions";

export function RevokeTokenButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm(`Revogar o token “${name}”? Agentes que o usam perderão o acesso.`)) return;

    startTransition(async () => {
      const result = await revokeAgentToken(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Token revogado");
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={pending}>
      <BanIcon /> Revogar
    </Button>
  );
}
