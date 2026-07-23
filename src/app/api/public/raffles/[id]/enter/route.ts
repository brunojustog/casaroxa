import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getAuthedCustomer } from "@/server/services/customer-session.service";
import { checkAppOnlyGate, enterRaffleFree } from "@/server/services/raffle.service";
import { BusinessError } from "@/server/auth-helpers";
import { sendText } from "@/server/services/whatsapp.service";

/**
 * Inscrição GRATUITA em rifa. Cliente envia os números escolhidos da
 * grade. Lê cookie de referral pra premiar quem indicou.
 */
const bodySchema = z.object({
  numbers: z.array(z.number().int().min(1)).min(1).max(500),
  /// Endpoint da inscrição de push deste navegador — exigido em rifa appOnly.
  pushEndpoint: z.string().max(1000).optional(),
});

const REF_COOKIE = "casaroxa_ref";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const customer = await getAuthedCustomer();
  if (!customer) {
    return NextResponse.json(
      {
        ok: false,
        error: "Identifique-se pelo WhatsApp pra participar do sorteio.",
        needsAuth: true,
      },
      { status: 401 },
    );
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  // Lê cookie de referral — formato "raffleId:referrerId"
  let referrerCustomerId: string | null = null;
  const store = await cookies();
  const refCookie = store.get(REF_COOKIE)?.value;
  if (refCookie) {
    const [cookieRaffleId, cookieRefId] = refCookie.split(":");
    if (cookieRaffleId === id && cookieRefId && cookieRefId !== customer.id) {
      referrerCustomerId = cookieRefId;
    }
  }

  try {
    await checkAppOnlyGate(id, customer.id, parsed.data.pushEndpoint ?? null);
    const result = await enterRaffleFree(
      id,
      customer.id,
      parsed.data.numbers,
      referrerCustomerId,
    );

    // Limpa cookie de referral (já foi usado pra essa rifa)
    if (referrerCustomerId) {
      store.delete(REF_COOKIE);
    }

    // Dispara WhatsApp pro referrer (best-effort) avisando do bônus
    if (result.referralAwarded) {
      const r = result.referralAwarded;
      sendText({
        phone: r.referrerPhone,
        message: `🎁 *Você ganhou um número bônus!*\n\nUma indicação sua acabou de entrar no sorteio *${result.raffleName}*. Como agradecimento, te demos o número *${r.number}* automaticamente.\n\nBoa sorte! 🍀`,
        event: "RAFFLE_WIN",
        bypassToggles: true,
      }).catch((e) => console.error("[raffles/enter] referral whatsapp:", e));
    }

    return NextResponse.json({
      ok: true,
      numbers: result.entries.map((e) => e.number),
      referralAwarded: result.referralAwarded
        ? { number: result.referralAwarded.number }
        : null,
    });
  } catch (e) {
    if (e instanceof BusinessError) {
      return NextResponse.json(
        { ok: false, error: e.message },
        { status: 400 },
      );
    }
    console.error("[raffles/enter]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado. Tente de novo." },
      { status: 500 },
    );
  }
}
