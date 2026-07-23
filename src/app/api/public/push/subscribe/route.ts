/**
 * POST /api/public/push/subscribe — inscrição de push de CLIENTE do site.
 * Sem auth (o site público não tem login obrigatório). Telefone é opcional
 * e serve pra vincular a inscrição ao cadastro do cliente (sorteios etc.).
 */
import { NextResponse } from "next/server";
import { saveCustomerSubscription } from "@/server/services/push.service";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    phone?: string;
  } | null;

  if (!body?.endpoint || !body.keys?.p256dh || !body.keys.auth) {
    return NextResponse.json(
      { ok: false, error: "Subscription inválida" },
      { status: 400 },
    );
  }
  if (body.endpoint.length > 1000 || (body.phone && body.phone.length > 40)) {
    return NextResponse.json(
      { ok: false, error: "Dados inválidos" },
      { status: 400 },
    );
  }

  await saveCustomerSubscription({
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    userAgent: req.headers.get("user-agent"),
    phone: body.phone ?? null,
  });
  return NextResponse.json({ ok: true });
}
