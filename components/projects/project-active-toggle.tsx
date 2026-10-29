"use client";

import { Loader2Icon, PowerIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setProjectActive } from "@/lib/projects/actions";

type ProjectActiveToggleProps = { id: string; active: boolean; size?: "default" | "sm" };

/** Liga ou desliga o acesso do MCP ao projeto. */
export function ProjectActiveToggle({ id, active, size = "default" }: ProjectActiveToggleProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onToggle() {
    startTransition(async () => {
      const result = await setProjectActive(id, !active);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(active ? "Projeto desativado" : "Projeto ativado");
      router.refresh();
    });
  }

  return (
    <Button variant={active ? "outline" : "default"} size={size} onClick={onToggle} disabled={pending}>
      {pending ? <Loader2Icon className="animate-spin" /> : <PowerIcon />}
      {active ? "Desativar projeto" : "Ativar projeto"}
    </Button>
  );
}
