import { NextResponse } from "next/server";

import { authenticateTaskRequest } from "@/lib/tasks/auth";
import { listTaskProjects } from "@/lib/tasks/service";

/** Projetos da conta, para a extensão validar a conexão e associar o repositório aberto a um projeto. */
export async function GET(request: Request) {
  const auth = await authenticateTaskRequest(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({ projects: await listTaskProjects(auth.caller.ownerId) });
}
