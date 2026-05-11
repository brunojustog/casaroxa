import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/services/customer-session.service";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
