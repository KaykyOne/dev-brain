import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { authenticateTaskRequest, jsonError } from "@/lib/tasks/auth";
import { clearFinishedTasks, createTask, listTasks } from "@/lib/tasks/service";
import { checkAttachments, createTaskSchema, sanitizeFileName } from "@/lib/validations/task";

const parseSlugs = (value: string | null) =>
  value
    ?.split(",")
    .map((slug) => slug.trim())
    .filter(Boolean)
    .slice(0, 50);

/** Lista as tarefas. `?projects=a,b` filtra pelos slugs dos projetos. */
export async function GET(request: NextRequest) {
  const auth = await authenticateTaskRequest(request);
  if (!auth.ok) return auth.response;

  const tasks = await listTasks(auth.caller.ownerId, {
    projects: parseSlugs(request.nextUrl.searchParams.get("projects")),
  });
  return NextResponse.json({ tasks });
}

/**
 * Cadastra uma tarefa. Aceita `multipart/form-data` (campos da tarefa + arquivos em `attachments`)
 * ou JSON com `attachments: [{ name, mimeType, data (base64) }]`.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateTaskRequest(request);
  if (!auth.ok) return auth.response;

  let fields: Record<string, unknown>;
  let files: { name: string; mimeType: string; content: Buffer }[] = [];

  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      fields = Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === "string"));
      files = await Promise.all(
        form
          .getAll("attachments")
          .filter((value): value is File => typeof value !== "string")
          .map(async (file) => ({
            name: sanitizeFileName(file.name),
            mimeType: file.type || "application/octet-stream",
            content: Buffer.from(await file.arrayBuffer()),
          })),
      );
    } else {
      const body = (await request.json()) as Record<string, unknown>;
      const raw = Array.isArray(body.attachments) ? body.attachments : [];
      fields = body;
      files = raw.map((item: { name?: unknown; mimeType?: unknown; data?: unknown }) => ({
        name: sanitizeFileName(String(item.name ?? "")),
        mimeType: typeof item.mimeType === "string" && item.mimeType ? item.mimeType : "application/octet-stream",
        content: Buffer.from(String(item.data ?? ""), "base64"),
      }));
    }
  } catch {
    return jsonError(400, "Corpo da requisição inválido");
  }

  const parsed = createTaskSchema.safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", fieldErrors: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }

  const attachmentError = checkAttachments(files.map((file) => ({ name: file.name, size: file.content.length })));
  if (attachmentError) {
    return NextResponse.json({ error: attachmentError, fieldErrors: { attachments: [attachmentError] } }, { status: 400 });
  }

  const result = await createTask({
    ownerId: auth.caller.ownerId,
    values: parsed.data,
    attachments: files,
    source: auth.caller.source,
  });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ task: result.data }, { status: 201 });
}

/** Remove as tarefas concluídas e canceladas (`?projects=a,b` restringe aos projetos). */
export async function DELETE(request: NextRequest) {
  const auth = await authenticateTaskRequest(request);
  if (!auth.ok) return auth.response;

  const removed = await clearFinishedTasks(auth.caller.ownerId, parseSlugs(request.nextUrl.searchParams.get("projects")));
  return NextResponse.json({ removed });
}
