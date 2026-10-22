import { NextResponse } from "next/server";

import { logActivity } from "@/lib/activity";
import { destroySession, validateSession } from "@/lib/auth/session";

export async function POST() {
  const user = await validateSession();
  await destroySession();
  if (user) await logActivity({ action: "auth.logout", actorId: user.id });
  return new NextResponse(null, { status: 204 });
}
