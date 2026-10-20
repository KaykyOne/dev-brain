"use client";

import { UnplugIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { unlinkLibrarySkill } from "@/lib/skills/actions";

/** Remove a skill da biblioteca deste projeto. A skill continua na biblioteca. */
export function UnlinkSkillButton({ projectId, skillId, name }: { projectId: string; skillId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm(`Remover “${name}” deste projeto? Ela continua na biblioteca.`)) return;

    startTransition(async () => {
      const result = await unlinkLibrarySkill(projectId, skillId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Skill removida do projeto");
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={pending} aria-label={`Remover ${name} do projeto`} title="Remover do projeto">
      <UnplugIcon />
    </Button>
  );
}
