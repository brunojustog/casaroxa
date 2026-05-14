/**
 * POST /api/public/order-request/[id]/pay
 *
 * Endpoint público sem auth — cliente preenche CPF/CNPJ e o sistema
 * gera (ou retorna a existente) charge Asaas pro sinal da encomenda.
 *
 * Body: { cpfCnpj: string }
 * Response: { ok: true, invoiceUrl: string } | { ok: false, error: string }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidCpfOrCnpj } from "@/lib/cpf-cnpj";
import { BusinessError } from "@/server/auth-helpers";
import { initiateOrderRequestDepositPayment } from "@/server/services/payment.service";

const schema = z.object({
  cpfCnpj: z
    .string()
    .min(11)
    .max(20)
    .refine(isValidCpfOrCnpj, "CPF/CNPJ inválido."),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido." },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await initiateOrderRequestDepositPayment({
      orderRequestId: id,
      cpfCnpj: parsed.data.cpfCnpj,
    });
    return NextResponse.json({
      ok: true,
      pixPayload: result.pixPayload,
      pixQrCodeBase64: result.pixQrCodeBase64,
      invoiceUrl: result.invoiceUrl,
      value: result.value,
      dueDate: result.dueDate.toISOString(),
    });
  } catch (e) {
    if (e instanceof BusinessError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    console.error("[api/public/order-request/pay]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado. Tente novamente." },
      { status: 500 },
    );
  }
}
