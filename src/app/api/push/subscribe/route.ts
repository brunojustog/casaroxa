import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { saveSubscription } from "@/server/services/push.service";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    | null;
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys.auth) {
    return NextResponse.json({ ok: false, error: "Subscription inválida" }, { status: 400 });
  }
  await saveSubscription(
    session.user.id,
    body.endpoint,
    body.keys.p256dh,
    body.keys.auth,
    req.headers.get("user-agent"),
  );
  return NextResponse.json({ ok: true });
}
