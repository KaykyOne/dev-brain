import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/dal";
import { contextRepos } from "@/lib/context-repo";
import { getProjectBySlug } from "@/lib/projects/queries";
import { getRepoInfo } from "@/lib/projects/repo-info";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/projects/[slug]/files/[...path]">): Promise<Metadata> {
  const { path } = await params;
  return { title: path.map(decodeURIComponent).join("/") };
}

export default async function ProjectFilePage({ params }: PageProps<"/projects/[slug]/files/[...path]">) {
  const { slug, path } = await params;
  const user = await getCurrentUser();
  const project = await getProjectBySlug(user.id, slug);
  await getRepoInfo(project);

  const file = await contextRepos.read(project.slug, path.map(decodeURIComponent).join("/")).catch(() => null);
  if (!file) notFound();

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/projects/${project.slug}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          <ArrowLeftIcon /> {project.name}
        </Link>
        <h1 className="min-w-0 truncate font-mono text-sm font-medium">{file.path}</h1>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-4 font-mono text-sm leading-relaxed">
        {file.content}
      </pre>
    </>
  );
}
