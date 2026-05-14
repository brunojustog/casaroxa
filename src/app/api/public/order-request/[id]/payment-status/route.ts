/**
 * GET /api/public/order-request/[id]/payment-status
 *
 * Polling público pra UI da tracking saber se o sinal foi pago.
 * Sem auth — só retorna campos visíveis ao cliente.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const req = await prisma.orderRequest.findUnique({
    where: { id },
    select: {
      depositPaidAt: true,
      depositPayment: { select: { status: true } },
    },
  });
  if (!req) {
    return NextResponse.json(
      { ok: false, error: "Encomenda não encontrada." },
      { status: 404 },
    );
  }
  return NextResponse.json({
    ok: true,
    paid: !!req.depositPaidAt,
    paymentStatus: req.depositPayment?.status ?? null,
  });
}
