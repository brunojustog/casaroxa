import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { checkConnectionStatus } from "@/server/services/whatsapp.service";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }
  const result = await checkConnectionStatus();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, data: result.data });
}
