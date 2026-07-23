/** POST /api/public/push/unsubscribe — remove inscrição de push de cliente. */
import { NextResponse } from "next/server";
import { removeCustomerSubscription } from "@/server/services/push.service";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) {
    return NextResponse.json(
      { ok: false, error: "Endpoint obrigatório" },
      { status: 400 },
    );
  }
  await removeCustomerSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
