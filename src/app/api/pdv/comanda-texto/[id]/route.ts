import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getSaleComprovante } from "@/server/services/sales.service";

export const dynamic = "force-dynamic";

// Comandos ESC/POS embutidos no texto (o agente manda os bytes crus pra
// térmica em latin1, então os controles passam intactos):
const GRANDE = "\x1d\x21\x11"; // GS ! — dobro de largura e altura
const NORMAL = "\x1d\x21\x00";
const W = 42;
const hr = () => "-".repeat(W);

function qty(q: number) {
  return Number.isInteger(q) ? `${q}x` : `${q.toFixed(3).replace(".", ",")}kg`;
}

/**
 * Comanda da COZINHA — sem preços, letra grande, observações em destaque.
 * Par do cupom do entregador: o botão "Imprimir pedido" manda as duas.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const sale = await getSaleComprovante(id);
  if (!sale) return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 });

  const hora = new Date(sale.occurredAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  const or = sale.orderRequest;
  const modo = or
    ? or.deliveryMode === "DELIVERY"
      ? "ENTREGA"
      : "RETIRADA"
    : /Endereço:/i.test(sale.notes ?? "")
      ? "ENTREGA"
      : "BALCAO";
  const quando = or?.requestedFor
    ? new Date(or.requestedFor).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : null;

  const L: string[] = [];
  L.push(`${GRANDE}== COZINHA ==${NORMAL}`);
  L.push(`${GRANDE}PEDIDO #${sale.number}${NORMAL}`);
  L.push(`${hora}  ·  ${modo}${quando ? `  ·  p/ ${quando}` : ""}`);
  if (sale.customerName) L.push(`Cliente: ${sale.customerName}`.slice(0, W));
  L.push(hr());
  for (const it of sale.items) {
    const name = it.product?.name ?? it.combo?.name ?? "Item";
    L.push(`${GRANDE}${qty(Number(it.quantity))} ${name.slice(0, 19)}${NORMAL}`);
    if (name.length > 19) L.push(`   ${name.slice(19, 19 + W - 3)}`);
    if (it.notes) L.push(`${GRANDE} >> ${it.notes.slice(0, 17)}${NORMAL}`);
  }
  L.push(hr());
  if (sale.notes) {
    // Observações do pedido (sem repetir o bloco de endereço/telefone)
    const obs = sale.notes
      .split("\n")
      .filter((l) => !/^(Telefone|Endereço|Bairro|Referência|Nome|Pagamento|Cliente):/i.test(l.trim()))
      .join(" ")
      .trim();
    if (obs) {
      L.push(`${GRANDE}OBS:${NORMAL}`);
      let line = obs;
      while (line.length > W) {
        const cut = line.lastIndexOf(" ", W);
        L.push(line.slice(0, cut > 0 ? cut : W));
        line = line.slice(cut > 0 ? cut : W).trim();
      }
      L.push(line);
      L.push(hr());
    }
  }

  return new NextResponse(L.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
