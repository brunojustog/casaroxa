import { NextResponse } from "next/server";
import { getAuthedCustomer } from "@/server/services/customer-session.service";

/**
 * Retorna dados do cliente autenticado (cookie de sessão) ou {ok:false}
 * se não houver sessão. NUNCA expõe campos sensíveis (notes internas,
 * customerId no formato bruto pra outras chamadas, etc.) — só o que o
 * cliente precisa pra autopreencher checkout / ver histórico.
 */
export async function GET() {
  const customer = await getAuthedCustomer();
  if (!customer) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    authenticated: true,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      addressNumber: customer.addressNumber,
      addressComplement: customer.addressComplement,
      neighborhood: customer.neighborhood,
      reference: customer.reference,
      loyaltyPoints: customer.loyaltyPoints,
    },
  });
}
