import { NextResponse } from "next/server";
import {
  initiateOnlinePayment,
  NeedCpfError,
} from "@/server/services/payment.service";
import { BusinessError } from "@/server/auth-helpers";
import { z } from "zod";

const bodySchema = z
  .object({
    saleId: z.string().min(1).optional(),
    raffleEntryId: z.string().min(1).optional(),
    billingType: z.enum(["PIX", "CREDIT_CARD"]),
    cpfCnpj: z.string().optional(),
  })
  .refine(
    (v) =>
      (v.saleId && !v.raffleEntryId) || (!v.saleId && v.raffleEntryId),
    { message: "Informe saleId OU raffleEntryId (não os dois)." },
  );

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
    const result = parsed.data.saleId
      ? await initiateOnlinePayment({
          saleId: parsed.data.saleId,
          billingType: parsed.data.billingType,
          cpfCnpj,
        })
      : await initiateOnlinePayment({
          raffleEntryId: parsed.data.raffleEntryId!,
          billingType: parsed.data.billingType,
          cpfCnpj,
        });
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
