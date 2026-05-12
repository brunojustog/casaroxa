import { NextResponse } from "next/server";
import { getAuthedCustomer } from "@/server/services/customer-session.service";
import { reserveRaffleEntryForPurchase } from "@/server/services/raffle.service";
import {
  initiateOnlinePayment,
  NeedCpfError,
} from "@/server/services/payment.service";
import { BusinessError } from "@/server/auth-helpers";

/**
 * Cliente identificado compra ticket de sorteio pago (PIX). Cria entry
 * pendente (confirmed=false) e gera/retorna OnlinePayment do Asaas.
 *
 * Body: { cpfCnpj?: string }  — CPF é exigido em algum momento (Asaas).
 *
 * Idempotente: se cliente já tem entry pendente, retorna mesmo payment.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const customer = await getAuthedCustomer();
  if (!customer) {
    return NextResponse.json(
      {
        ok: false,
        error: "Identifique-se pelo WhatsApp pra comprar o ticket.",
        needsAuth: true,
      },
      { status: 401 },
    );
  }

  const { id: raffleId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    cpfCnpj?: string;
  };

  let cpfCnpj: string | undefined;
  if (body.cpfCnpj) {
    const digits = body.cpfCnpj.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      return NextResponse.json(
        { ok: false, error: "CPF/CNPJ inválido." },
        { status: 400 },
      );
    }
    cpfCnpj = digits;
  }

  try {
    const reserved = await reserveRaffleEntryForPurchase(
      raffleId,
      customer.id,
    );
    const payment = await initiateOnlinePayment({
      raffleEntryId: reserved.raffleEntryId,
      billingType: "PIX",
      cpfCnpj,
    });
    return NextResponse.json({
      ok: true,
      raffleEntryId: reserved.raffleEntryId,
      ticketPriceCents: reserved.ticketPriceCents,
      raffleName: reserved.raffleName,
      ...payment,
    });
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
    console.error("[raffles/buy-ticket]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado. Tente de novo." },
      { status: 500 },
    );
  }
}
