import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { removeSubscription } from "@/server/services/push.service";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) {
    return NextResponse.json({ ok: false, error: "Endpoint obrigatório" }, { status: 400 });
  }
  await removeSubscription(body.endpoint, session.user.id);
  return NextResponse.json({ ok: true });
}
