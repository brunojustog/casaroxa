import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { ping } from "@/server/services/asaas.service";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }
  const result = await ping();
  return NextResponse.json(result);
}
