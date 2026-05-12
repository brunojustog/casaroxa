import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedCustomer } from "@/server/services/customer-session.service";
import { reserveRaffleNumbersForPurchase } from "@/server/services/raffle.service";
import {
  initiateOnlinePayment,
  NeedCpfError,
} from "@/server/services/payment.service";
import { BusinessError } from "@/server/auth-helpers";
import { isValidCpfOrCnpj } from "@/lib/cpf-cnpj";
import { prisma } from "@/lib/prisma";

/**
 * Cliente identificado escolhe N números numa rifa paga, gera 1 PIX no
 * Asaas e recebe paymentId + dados pra UI mostrar o QR. Body:
 *   { numbers: number[]; cpfCnpj?: string }
 */
const bodySchema = z.object({
  numbers: z.array(z.number().int().min(1)).min(1).max(500),
  cpfCnpj: z.string().optional(),
});

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
    const digits = parsed.data.cpfCnpj.replace(/\D/g, "");
    if (!isValidCpfOrCnpj(digits)) {
      return NextResponse.json(
        { ok: false, error: "CPF/CNPJ inválido." },
        { status: 400 },
      );
    }
    cpfCnpj = digits;
  }

  let reserved: Awaited<ReturnType<typeof reserveRaffleNumbersForPurchase>> | null = null;
  try {
    reserved = await reserveRaffleNumbersForPurchase(
      raffleId,
      customer.id,
      parsed.data.numbers,
    );
    const payment = await initiateOnlinePayment({
      kind: "raffle",
      raffleId,
      customerId: customer.id,
      entryIds: reserved.entryIds,
      valueCents: reserved.totalCents,
      description: `Casa Roxa — Rifa "${reserved.raffleName}" (nº ${reserved.numbers.join(", ")})`,
      cpfCnpj,
    });
    return NextResponse.json({
      ok: true,
      raffleName: reserved.raffleName,
      numbers: reserved.numbers,
      ...payment,
    });
  } catch (e) {
    // Rollback SEMPRE: se reservou mas o payment não nasceu, libera os
    // números. Inclui NEED_CPF — quando o cliente voltar com CPF, o
    // reserveRaffleNumbersForPurchase cria as entries de novo (idempotente).
    // Sem isso, qualquer falha (NEED_CPF, erro Asaas, etc) deixa números
    // travados pra sempre.
    if (reserved) {
      await prisma.raffleEntry.deleteMany({
        where: { id: { in: reserved.entryIds }, confirmed: false },
      }).catch(() => {});
    }
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
