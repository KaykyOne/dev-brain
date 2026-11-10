import { z } from "zod";

import { authenticateTaskRequest, jsonError } from "@/lib/tasks/auth";
import { getAttachment } from "@/lib/tasks/service";

const uuid = z.uuid();

// Só imagens raster são exibidas inline; o resto (inclusive SVG, que pode ter script) sempre baixa.
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export async function GET(request: Request, ctx: RouteContext<"/api/tasks/[id]/attachments/[attachmentId]">) {
  const auth = await authenticateTaskRequest(request);
  if (!auth.ok) return auth.response;

  const { id, attachmentId } = await ctx.params;
  if (!uuid.safeParse(id).success || !uuid.safeParse(attachmentId).success) return jsonError(404, "Anexo não encontrado");

  const file = await getAttachment(auth.caller.ownerId, id, attachmentId);
  if (!file) return jsonError(404, "Anexo não encontrado");

  const inline = INLINE_TYPES.has(file.mimeType);
  return new Response(new Uint8Array(file.content), {
    headers: {
      "Content-Type": inline ? file.mimeType : "application/octet-stream",
      "Content-Length": String(file.content.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
