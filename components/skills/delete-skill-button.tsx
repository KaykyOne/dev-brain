"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteSkill } from "@/lib/skills/actions";

export function DeleteSkillButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm(`Remover a skill “${name}”? O SKILL.md no repositório não é apagado.`)) return;

    startTransition(async () => {
      const result = await deleteSkill(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Skill removida");
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={pending} aria-label="Remover skill">
      <Trash2Icon />
    </Button>
  );
}
