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
import { isValidCpfOrCnpj } from "@/lib/cpf-cnpj";

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
  holder: z.object({
    name: z.string().trim().min(2, "Nome do titular é obrigatório").max(120),
    email: z.string().trim().toLowerCase().email("E-mail inválido").max(150),
    cpfCnpj: z
      .string()
      .transform(digits)
      .refine(
        (v) => (v.length === 11 || v.length === 14) && isValidCpfOrCnpj(v),
        "CPF/CNPJ do titular inválido",
      ),
    postalCode: z
      .string()
      .transform(digits)
      .refine((v) => v.length === 8, "CEP inválido (8 dígitos)"),
    addressNumber: z.string().trim().min(1, "Número do endereço é obrigatório").max(10),
    phone: z
      .string()
      .transform(digits)
      .refine((v) => v.length >= 10 && v.length <= 13, "Telefone inválido"),
  }),
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

  const { saleId, card, holder } = parsed.data;
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
      holderInfo: {
        name: holder.name,
        email: holder.email,
        cpfCnpj: holder.cpfCnpj,
        postalCode: holder.postalCode,
        addressNumber: holder.addressNumber,
        phone: holder.phone,
      },
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
