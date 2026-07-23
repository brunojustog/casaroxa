/**
 * POST /api/public/payments/pay-card — checkout transparente de cartão.
 *
 * Dados do cartão passam por aqui APENAS em trânsito (HTTPS) e vão direto
 * pro Asaas — nunca são salvos, nunca são logados. remoteIp do cliente é
 * repassado pro antifraude do Asaas (obrigatório).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { paySaleWithCreditCard } from "@/server/services/payment.service";
import { BusinessError } from "@/server/auth-helpers";

const digits = (v: string) => v.replace(/\D/g, "");

const bodySchema = z.object({
  saleId: z.string().min(1).max(60),
  card: z.object({
    holderName: z.string().trim().min(2, "Nome impresso no cartão é obrigatório").max(100),
    number: z
      .string()
      .transform(digits)
      .refine((v) => v.length >= 13 && v.length <= 19, "Número do cartão inválido"),
    expiry: z
      .string()
      .trim()
      .refine((v) => /^\d{2}\s*\/\s*\d{2,4}$/.test(v), "Validade no formato MM/AA"),
    ccv: z
      .string()
      .transform(digits)
      .refine((v) => v.length === 3 || v.length === 4, "CVV inválido"),
  }),
  // Endereço de fatura opcional — sem ele o backend usa CEP da loja +
  // número do cadastro (decisão do negócio: local, cliente conhecido).
  billing: z
    .object({
      postalCode: z
        .string()
        .transform(digits)
        .refine((v) => v.length === 8, "CEP inválido (8 dígitos)"),
      addressNumber: z.string().trim().min(1).max(10),
    })
    .optional(),
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

  const { saleId, card, billing } = parsed.data;
  const [mm, yy] = card.expiry.split("/").map((s) => s.trim());
  const expiryYear = yy.length === 2 ? `20${yy}` : yy;
  const remoteIp =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;

  try {
    const result = await paySaleWithCreditCard({
      saleId,
      creditCard: {
        holderName: card.holderName,
        number: card.number,
        expiryMonth: mm,
        expiryYear,
        ccv: card.ccv,
      },
      billing,
      remoteIp,
    });
    return NextResponse.json({ ok: true, paid: result.paid, status: result.status });
  } catch (e) {
    if (e instanceof BusinessError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    console.error("[pay-card] erro inesperado:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao processar. Tente de novo." },
      { status: 500 },
    );
  }
}
