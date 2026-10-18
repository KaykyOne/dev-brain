import type { Metadata } from "next";

import { ProjectForm } from "@/components/projects/project-form";
import { ProjectGuide } from "@/components/projects/project-guide";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentUser } from "@/lib/auth/dal";
import { listUniversalSkills } from "@/lib/skills/queries";

export const metadata: Metadata = { title: "Novo projeto" };

export default async function NewProjectPage() {
  const user = await getCurrentUser();
  const universalSkills = await listUniversalSkills(user.id);

  return (
    <>
      <PageHeader title={<>Novo projeto</>} description={<>Cria o projeto e o seu repositório git de contexto, já no padrão do hub.</>} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)]">
        <ProjectForm universalSkills={universalSkills.map(({ id, name }) => ({ id, name }))} />
        <ProjectGuide />
      </div>
    </>
  );
}
