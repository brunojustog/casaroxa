import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { getFiscalDocument } from "@/server/services/fiscal.service";
import { getSiteSettings } from "@/server/services/public-menu.service";
import { PAYMENT_METHOD_LABEL } from "@/lib/enums";
import { AutoPrint } from "../../pdv-cupom/[id]/AutoPrint";

export const metadata: Metadata = {
  title: "DANFE NFC-e — Casa Roxa",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

function brl(v: unknown) {
  return Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function qty(q: number) {
  return Number.isInteger(q) ? `${q}x` : `${q.toFixed(3).replace(".", ",")}kg`;
}
function fmtKey(k: string) {
  return k.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/**
 * DANFE NFC-e simplificado pra impressora térmica 58mm.
 * No ambiente SIMULADO sai com aviso gigante de "sem valor fiscal".
 */
export default async function PdvDanfePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [doc, settings] = await Promise.all([getFiscalDocument(id), getSiteSettings()]);
  if (!doc || doc.status === "PENDENTE") notFound();

  const qrSvg = doc.qrCodeUrl
    ? await QRCode.toString(doc.qrCodeUrl, { type: "svg", margin: 0, width: 140 })
    : null;

  const when = new Date(doc.authorizedAt ?? doc.createdAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const simulado = doc.environment === "SIMULADO";
  const homolog = doc.environment === "HOMOLOGACAO";

  return (
    <main className="cupom">
      <AutoPrint />
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { background: #fff; }
        .cupom {
          width: 58mm; margin: 0 auto; padding: 2mm 3mm 6mm;
          font-family: "Courier New", monospace; font-size: 10px;
          line-height: 1.35; color: #000;
        }
        .center { text-align: center; }
        .bold { font-weight: 700; }
        .big { font-size: 12.5px; }
        .small { font-size: 8.5px; }
        .hr { border-top: 1px dashed #000; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; gap: 4px; }
        .row .name { flex: 1; overflow: hidden; }
        .qr { display: flex; justify-content: center; margin: 6px 0; }
        .alert {
          border: 2px solid #000; text-align: center; font-weight: 700;
          padding: 3px; margin: 5px 0; font-size: 11px;
        }
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
      <p className="center">CNPJ 68.194.915/0001-19</p>
      <p className="center small">{settings.address ?? "Rua Quintino Bocaiuva, 1226"} — Jaú/SP</p>
      <div className="hr" />
      <p className="center bold">DANFE NFC-e — Documento Auxiliar</p>
      <p className="center small">da Nota Fiscal de Consumidor Eletrônica</p>

      {simulado && <div className="alert">*** EMISSÃO SIMULADA ***<br />SEM VALOR FISCAL</div>}
      {homolog && <div className="alert">EMITIDA EM HOMOLOGAÇÃO<br />SEM VALOR FISCAL</div>}
      {doc.status === "CANCELADA" && <div className="alert">*** NFC-e CANCELADA ***</div>}

      <div className="hr" />
      <div className="row">
        <span>NFC-e nº {doc.number}</span>
        <span>Série {doc.series}</span>
      </div>
      <div className="row">
        <span>Venda #{doc.sale.number}</span>
        <span>{when}</span>
      </div>
      <div className="hr" />

      {doc.sale.items.map((it) => (
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
        <span>R$ {brl(doc.totalAmount)}</span>
      </div>
      {doc.sale.payments.map((p) => (
        <div key={p.id} className="row">
          <span>{PAYMENT_METHOD_LABEL[p.method]}</span>
          <span>R$ {brl(p.amount)}</span>
        </div>
      ))}

      <div className="hr" />
      <p className="center small">
        {doc.cpfCnpj
          ? `CONSUMIDOR: ${doc.cpfCnpj.length === 11 ? "CPF" : "CNPJ"} ${doc.cpfCnpj}`
          : "CONSUMIDOR NÃO IDENTIFICADO"}
      </p>
      <p className="center small bold">Chave de acesso:</p>
      <p className="center small">{doc.accessKey ? fmtKey(doc.accessKey) : "—"}</p>
      {doc.protocol && (
        <p className="center small">Protocolo: {doc.protocol}</p>
      )}

      {qrSvg && (
        <>
          <p className="center small">Consulte pela chave ou QR code:</p>
          <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        </>
      )}

      <div className="hr" />
      <p className="center bold">Obrigado! Volte sempre &lt;3</p>
      <p className="center small">casaroxa.com.br</p>

      <div className="noprint">
        <button id="btn-print" type="button">Imprimir novamente</button>
      </div>
    </main>
  );
}
