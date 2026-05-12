import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "casaroxa_ref";
const DAYS_VALID = 30;

const bodySchema = z.object({
  ref: z.string().min(1).max(100),
  raffleId: z.string().min(1),
});

/**
 * Cliente B clica num link de indicação tipo /sorteio/[id]?ref=customerA.
 * O componente client chama esse endpoint pra setar cookie httpOnly que
 * sobrevive até o B fazer login e se inscrever. Quando B se inscreve, o
 * service de raffle lê esse cookie e dá entry bonus pro A.
 *
 * Validações:
 *  - ref precisa ser um Customer válido E ativo
 *  - raffleId precisa existir e ser GRATUITA (ticketPriceCents === 0)
 *  - sem auto-referência (se cliente já está logado e é o próprio A,
 *    o cookie ainda é aceito — a validação real fica no enterRaffleFree)
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Dados inválidos." },
      { status: 400 },
    );
  }

  const [referrer, raffle] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: parsed.data.ref },
      select: { id: true, active: true },
    }),
    prisma.raffle.findUnique({
      where: { id: parsed.data.raffleId },
      select: { id: true, ticketPriceCents: true, status: true },
    }),
  ]);

  if (!referrer || !referrer.active) {
    return NextResponse.json(
      { ok: false, error: "Link de indicação inválido." },
      { status: 400 },
    );
  }
  if (!raffle) {
    return NextResponse.json(
      { ok: false, error: "Sorteio não encontrado." },
      { status: 400 },
    );
  }
  if (raffle.ticketPriceCents > 0) {
    return NextResponse.json(
      { ok: false, error: "Indicações só valem em sorteio gratuito." },
      { status: 400 },
    );
  }

  // Cookie escopado por rifa: "raffleId:referrerId"
  const value = `${parsed.data.raffleId}:${parsed.data.ref}`;
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + DAYS_VALID * 24 * 60 * 60 * 1000),
  });

  return NextResponse.json({ ok: true });
}
