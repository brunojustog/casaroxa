import { NextResponse } from "next/server";
import { initiateOnlinePayment } from "@/server/services/payment.service";
import { BusinessError } from "@/server/auth-helpers";
import { z } from "zod";

const bodySchema = z.object({
  saleId: z.string().min(1),
  billingType: z.enum(["PIX", "CREDIT_CARD"]),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  try {
    const result = await initiateOnlinePayment(
      parsed.data.saleId,
      parsed.data.billingType,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof BusinessError) {
      return NextResponse.json(
        { ok: false, error: e.message },
        { status: 400 },
      );
    }
    console.error("[payments/initiate]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado. Tente de novo." },
      { status: 500 },
    );
  }
}
