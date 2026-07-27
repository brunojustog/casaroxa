import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSaleComprovante } from "@/server/services/sales.service";
import { getSiteSettings } from "@/server/services/public-menu.service";
import { PAYMENT_METHOD_LABEL } from "@/lib/enums";
import { AutoPrint } from "./AutoPrint";

export const metadata: Metadata = {
  title: "Cupom — Casa Roxa",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

function brl(v: unknown) {
  return Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function qty(q: number) {
  return Number.isInteger(q) ? `${q}x` : `${q.toFixed(3).replace(".", ",")}kg`;
}

/**
 * Cupom NÃO FISCAL pra impressora térmica 58mm do PDV.
 * Fora do grupo (app) — página limpa, imprime sozinha ao abrir.
 */
export default async function PdvCupomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [sale, settings] = await Promise.all([getSaleComprovante(id), getSiteSettings()]);
  if (!sale) notFound();

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
  });

  return (
    <main className="cupom">
      <AutoPrint />
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { background: #fff; }
        .cupom {
          width: 58mm;
          margin: 0 auto;
          padding: 2mm 3mm 6mm;
          font-family: "Courier New", monospace;
          font-size: 10.5px;
          line-height: 1.35;
          color: #000;
        }
        .center { text-align: center; }
        .bold { font-weight: 700; }
        .big { font-size: 13px; }
        .hr { border-top: 1px dashed #000; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; gap: 4px; }
        .row .name { flex: 1; overflow: hidden; }
        .noprint { text-align: center; margin-top: 16px; }
        .noprint button {
          font-family: inherit; font-size: 13px; padding: 8px 20px;
          background: #5B21B6; color: #fff; border: 0; border-radius: 6px; cursor: pointer;
        }
        @media print {
          .noprint { display: none; }
          @page { size: 58mm auto; margin: 0; }
        }
      `}</style>

      <p className="center bold big">CASA ROXA ASSADOS</p>
      <p className="center">{settings.address ?? "Rua Quintino Bocaiuva, 1226"}</p>
      <p className="center">{settings.addressNeighborhood ?? "Vila Nova — Jaú/SP"}</p>
      <p className="center">CNPJ 68.194.915/0001-19</p>
      <div className="hr" />
      <div className="row">
        <span className="bold">VENDA #{sale.number}</span>
        <span>{when}</span>
      </div>
      {sale.customerName && <p>Cliente: {sale.customerName}</p>}
      <div className="hr" />

      {sale.items.map((it) => (
        <div key={it.id} className="row">
          <span className="name">
            {qty(Number(it.quantity))} {it.product?.name ?? it.combo?.name ?? "Item"}
          </span>
          <span>{brl(it.totalPrice)}</span>
        </div>
      ))}

      <div className="hr" />
      <div className="row bold big">
        <span>TOTAL</span>
        <span>R$ {brl(sale.totalRevenue)}</span>
      </div>
      {Number(sale.totalDiscount) > 0 && (
        <div className="row">
          <span>Desconto</span>
          <span>R$ {brl(sale.totalDiscount)}</span>
        </div>
      )}
      {sale.payments.map((p) => (
        <div key={p.id} className="row">
          <span>{PAYMENT_METHOD_LABEL[p.method]}</span>
          <span>R$ {brl(p.amount)}</span>
        </div>
      ))}
      {troco > 0 && (
        <div className="row bold">
          <span>TROCO</span>
          <span>R$ {brl(troco)}</span>
        </div>
      )}

      <div className="hr" />
      <p className="center">*** SEM VALOR FISCAL ***</p>
      <p className="center bold">Obrigado! Volte sempre &lt;3</p>
      <p className="center">casaroxa.com.br</p>

      <div className="noprint">
        <button id="btn-print" type="button">
          Imprimir novamente
        </button>
      </div>
    </main>
  );
}
