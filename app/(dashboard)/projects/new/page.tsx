import type { Metadata } from "next";

import { ProjectForm } from "@/components/projects/project-form";
import { ProjectGuide } from "@/components/projects/project-guide";
import { getCurrentUser } from "@/lib/auth/dal";
import { listUniversalSkills } from "@/lib/skills/queries";

export const metadata: Metadata = { title: "Novo projeto" };

export default async function NewProjectPage() {
  const user = await getCurrentUser();
  const universalSkills = await listUniversalSkills(user.id);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Novo projeto</h1>
        <p className="text-sm text-muted-foreground">
          O repositório GitHub é vinculado depois, nas configurações do projeto.
        </p>
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)]">
        <ProjectForm universalSkills={universalSkills.map(({ id, name }) => ({ id, name }))} />
        <ProjectGuide />
      </div>
    </>
  );
}
