import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { SaleStatus } from "@prisma/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SaleHeaderEditor } from "@/components/sales/SaleHeaderEditor";
import { SaleItemsEditor } from "@/components/sales/SaleItemsEditor";
import { SalePaymentsEditor } from "@/components/sales/SalePaymentsEditor";
import { SaleStatusBar } from "@/components/sales/SaleStatusBar";
import { SaleProgressBar } from "@/components/sales/SaleProgressBar";
import { SendNpsButton } from "@/components/sales/SendNpsButton";
import {
  getSaleById,
  listActiveCombosForSale,
  listActiveProductsForSale,
} from "@/server/services/sales.service";
import { getSettings } from "@/server/services/settings.service";
import { SALE_STATUS_LABEL } from "@/lib/enums";
import { formatBRL, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function statusTone(status: SaleStatus) {
  switch (status) {
    case "CONCLUIDA":
      return "success" as const;
    case "ABERTA":
      return "info" as const;
    case "CANCELADA":
      return "neutral" as const;
  }
}

export default async function VendaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [sale, products, combos, settings] = await Promise.all([
    getSaleById(id),
    listActiveProductsForSale(),
    listActiveCombosForSale(),
    getSettings(),
  ]);
  if (!sale) notFound();

  const readOnly = sale.status !== SaleStatus.ABERTA;
  const tone = statusTone(sale.status);

  const catalog = [
    ...products.map((p) => ({
      kind: "PRODUTO" as const,
      id: p.id,
      name: p.name,
      salePrice: Number(p.salePrice ?? 0),
    })),
    ...combos.map((c) => ({
      kind: "COMBO" as const,
      id: c.id,
      name: c.name,
      salePrice: Number(c.salePrice ?? 0),
    })),
  ];

  const itemRows = sale.items.map((it) => ({
    id: it.id,
    productId: it.productId,
    comboId: it.comboId,
    productName: it.product?.name ?? null,
    comboName: it.combo?.name ?? null,
    quantity: Number(it.quantity),
    unitPrice: Number(it.unitPrice),
    unitCost: Number(it.unitCost),
    totalPrice: Number(it.totalPrice),
    totalCost: Number(it.totalCost),
    notes: it.notes,
  }));

  const paymentRows = sale.payments.map((p) => ({
    id: p.id,
    method: p.method,
    amount: Number(p.amount),
    feePercent: Number(p.feePercent),
    feeAmount: Number(p.feeAmount),
    netAmount: Number(p.netAmount),
  }));

  return (
    <div className="space-y-5">
      <Link
        href="/vendas"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para vendas
      </Link>

      <PageHeader
        title={`Venda #${sale.number}`}
        description={
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
            <span className="text-slate-500">{formatDateTime(sale.occurredAt)}</span>
            {sale.customerName && (
              <span className="text-slate-600">· {sale.customerName}</span>
            )}
            {sale.closedAt && (
              <span className="text-slate-500">
                · concluída {formatDateTime(sale.closedAt)}
                {sale.closedBy?.name ? ` por ${sale.closedBy.name}` : ""}
              </span>
            )}
            {sale.cancelledAt && (
              <span className="text-red-600">
                · cancelada {formatDateTime(sale.cancelledAt)}
                {sale.cancelReason ? ` — "${sale.cancelReason}"` : ""}
              </span>
            )}
          </span>
        }
        actions={<Badge tone={tone}>{SALE_STATUS_LABEL[sale.status]}</Badge>}
      />

      <SaleStatusBar
        saleId={sale.id}
        status={sale.status}
        itemCount={sale.items.length}
      />

      {sale.status !== "CANCELADA" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Andamento do pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <SaleProgressBar
              saleId={sale.id}
              current={sale.progress}
              estimateMinutes={sale.progressEstimateMinutes}
            />
          </CardContent>
        </Card>
      )}

      {/* NPS — só pra Sales não-canceladas que já foram entregues */}
      {sale.status !== "CANCELADA" &&
        (sale.progress === "ENTREGUE" || sale.status === "CONCLUIDA") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Avaliação do cliente</CardTitle>
            </CardHeader>
            <CardContent>
              {sale.review ? (
                <p className="text-sm">
                  Cliente já avaliou: <strong>{sale.review.score}/10</strong>{" "}
                  <span className="text-xs text-slate-500">
                    ({sale.review.category})
                  </span>
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    Manda um link pra esse cliente avaliar o pedido.{" "}
                    {sale.npsSentAt && (
                      <span className="text-xs">
                        (Último envio:{" "}
                        {formatDateTime(sale.npsSentAt)})
                      </span>
                    )}
                  </p>
                  <SendNpsButton
                    saleId={sale.id}
                    alreadySent={!!sale.npsSentAt}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Cabeçalho</CardTitle>
            </CardHeader>
            <CardContent>
              <SaleHeaderEditor
                saleId={sale.id}
                initial={{
                  occurredAt: sale.occurredAt,
                  source: sale.source,
                  customerName: sale.customerName,
                  notes: sale.notes,
                }}
                readOnly={readOnly}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Itens vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <SaleItemsEditor
                saleId={sale.id}
                items={itemRows}
                catalog={catalog}
                readOnly={readOnly}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pagamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <SalePaymentsEditor
                saleId={sale.id}
                payments={paymentRows}
                defaultFees={{
                  card: Number(settings.cardFeePercent),
                  app: Number(settings.appFeePercent),
                }}
                readOnly={readOnly}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Bruto" value={formatBRL(sale.totalRevenue)} bold />
              <Row label="Custo (CMV)" value={formatBRL(sale.totalCost)} muted />
              <Row label="Pago" value={formatBRL(sale.totalPaid)} />
              <Row label="Taxas" value={formatBRL(sale.totalFees)} muted />
              <Row label="Desconto" value={formatBRL(sale.totalDiscount)} muted />
              <div className="border-t border-slate-200 pt-2 mt-2">
                <Row label="Líquido" value={formatBRL(sale.totalNet)} bold large />
              </div>
              {Number(sale.totalRevenue) > 0 && (
                <p className="text-xs text-slate-500 pt-1">
                  CMV real:{" "}
                  <span className="font-medium text-slate-700">
                    {((Number(sale.totalCost) / Number(sale.totalRevenue)) * 100).toFixed(1)}%
                  </span>
                </p>
              )}
            </CardContent>
          </Card>

          {sale.status === SaleStatus.ABERTA && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-600">
                  Esta venda <strong>está em aberto</strong>. Adicione itens e pagamentos,
                  depois clique em <strong>Concluir venda</strong> no topo da página
                  para descontar o estoque automaticamente.
                </p>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
  large,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  large?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={muted ? "text-slate-500 text-xs" : "text-slate-600"}>
        {label}
      </span>
      <span
        className={`tabular-nums ${large ? "text-base " : ""}${bold ? "font-semibold text-slate-900" : "text-slate-700"}`}
      >
        {value}
      </span>
    </div>
  );
}
