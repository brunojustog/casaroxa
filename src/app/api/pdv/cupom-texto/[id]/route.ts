import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getSaleComprovante } from "@/server/services/sales.service";
import { getSiteSettings } from "@/server/services/public-menu.service";
import { PAYMENT_METHOD_LABEL } from "@/lib/enums";

export const dynamic = "force-dynamic";

const W = 42; // colunas da Custom P3 (80mm, fonte padrão = 42 chars/linha)

function center(s: string) {
  const pad = Math.max(0, Math.floor((W - s.length) / 2));
  return " ".repeat(pad) + s;
}
function row(left: string, right: string) {
  const space = Math.max(1, W - left.length - right.length);
  return left + " ".repeat(space) + right;
}
function hr() {
  return "-".repeat(W);
}
function brl(v: unknown) {
  return Number(v ?? 0).toFixed(2).replace(".", ",");
}
function qty(q: number) {
  return Number.isInteger(q) ? `${q}x` : `${q.toFixed(3).replace(".", ",")}kg`;
}

/**
 * Cupom NÃO FISCAL em texto puro (32 colunas) — consumido pelo agente de
 * impressão local do caixa, que manda direto pra térmica via COM.
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
  const [sale, settings] = await Promise.all([
    getSaleComprovante(id),
    getSiteSettings(),
  ]);
  if (!sale) return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 });

  const troco = sale.payments.reduce((acc, p) => {
    const r = p.receivedAmount ? Number(p.receivedAmount) : 0;
    return acc + Math.max(0, r - Number(p.amount));
  }, 0);

  const when = new Date(sale.closedAt ?? sale.occurredAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  const L: string[] = [];
  L.push(center("CASA ROXA ASSADOS"));
  L.push(center(settings.address ?? "R. Quintino Bocaiuva, 1226"));
  L.push(center(settings.addressNeighborhood ?? "Vila Nova - Jau/SP"));
  L.push(center("CNPJ 68.194.915/0001-19"));
  L.push(hr());
  L.push(row(`VENDA #${sale.number}`, when));
  if (sale.customerName) L.push(`Cliente: ${sale.customerName}`.slice(0, W));

  // ---- Dados de entrega/contato (pro entregador) ----
  const wrap = (prefix: string, text: string) => {
    let line = prefix + text;
    while (line.length > W) {
      const cut = line.lastIndexOf(" ", W);
      const at = cut > prefix.length ? cut : W;
      L.push(line.slice(0, at));
      line = "  " + line.slice(at).trim();
    }
    L.push(line);
  };
  const or = sale.orderRequest;
  const phone = or?.customerPhone || sale.customer?.phone;
  if (phone) L.push(`Fone: ${phone}`.slice(0, W));
  const addrSource =
    or?.address ? or : sale.customer?.address ? sale.customer : null;
  if (addrSource?.address) {
    const addr = [
      addrSource.address,
      addrSource.addressNumber ? `nº ${addrSource.addressNumber}` : null,
      addrSource.addressComplement,
    ]
      .filter(Boolean)
      .join(", ");
    wrap("Entrega: ", addr);
    if (addrSource.neighborhood) wrap("Bairro: ", addrSource.neighborhood);
    if (addrSource.reference) wrap("Ref: ", addrSource.reference);
  } else if (sale.notes) {
    // Pedidos do site guardam o endereço nos notes estruturados
    for (const linha of sale.notes.split("\n")) {
      if (/^(Telefone|Endereço|Bairro|Referência|Entrega|Retirada):/i.test(linha)) {
        wrap("", linha.trim());
      }
    }
  }
  L.push(hr());
  for (const it of sale.items) {
    const name = it.product?.name ?? it.combo?.name ?? "Item";
    const q = qty(Number(it.quantity));
    const price = brl(it.totalPrice);
    const label = `${q} ${name}`;
    if (label.length + price.length + 1 <= W) {
      L.push(row(label, price));
    } else {
      L.push(label.slice(0, W));
      L.push(row("", price));
    }
  }
  L.push(hr());
  L.push(row("TOTAL", `R$ ${brl(sale.totalRevenue)}`));
  if (Number(sale.totalDiscount) > 0) L.push(row("Desconto", `R$ ${brl(sale.totalDiscount)}`));
  for (const p of sale.payments) {
    L.push(row(PAYMENT_METHOD_LABEL[p.method].slice(0, 18), `R$ ${brl(p.amount)}`));
  }
  if (troco > 0) L.push(row("TROCO", `R$ ${brl(troco)}`));

  // Pedido de entrega: instrução de cobrança em destaque pro entregador
  const isEntrega =
    !!addrSource?.address || /Endereço:/i.test(sale.notes ?? "");
  if (isEntrega) {
    const falta = Number(sale.totalRevenue) - Number(sale.totalPaid);
    L.push(hr());
    L.push(
      center(
        falta > 0.009
          ? `>>> COBRAR R$ ${brl(falta)} NA ENTREGA <<<`
          : ">>> PEDIDO JA PAGO <<<",
      ),
    );
  }
  L.push(hr());
  L.push(center("*** SEM VALOR FISCAL ***"));
  L.push(center("Obrigado! Volte sempre <3"));
  L.push("");
  L.push(center("Baixe nosso app e concorra a"));
  L.push(center("sorteios toda semana!"));
  L.push(center("casaroxa.com.br"));

  return new NextResponse(L.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
