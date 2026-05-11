import { NextResponse } from "next/server";
import {
  initiateOnlinePayment,
  NeedCpfError,
} from "@/server/services/payment.service";
import { BusinessError } from "@/server/auth-helpers";
import { z } from "zod";

const bodySchema = z.object({
  saleId: z.string().min(1),
  billingType: z.enum(["PIX", "CREDIT_CARD"]),
  /** Só dígitos. Validado abaixo (11 = CPF, 14 = CNPJ). */
  cpfCnpj: z.string().optional(),
});

function sanitizeCpfCnpj(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11 && digits.length !== 14) return null;
  return digits;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  let cpfCnpj: string | undefined;
  if (parsed.data.cpfCnpj) {
    const clean = sanitizeCpfCnpj(parsed.data.cpfCnpj);
    if (!clean) {
      return NextResponse.json(
        { ok: false, error: "CPF/CNPJ inválido. Use só os dígitos." },
        { status: 400 },
      );
    }
    cpfCnpj = clean;
  }

  try {
    const result = await initiateOnlinePayment(
      parsed.data.saleId,
      parsed.data.billingType,
      cpfCnpj,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof NeedCpfError) {
      return NextResponse.json(
        { ok: false, code: "NEED_CPF", error: e.message },
        { status: 400 },
      );
    }
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
