import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { logoutSession } from "@/server/services/whatsapp.service";

/** Faz logout — cliente vai precisar parear de novo via QR. */
export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }
  const r = await logoutSession();
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: r.error ?? "Falha ao desconectar." },
      { status: 200 },
    );
  }
  return NextResponse.json({ ok: true });
}
