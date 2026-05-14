import { redirect } from "next/navigation";
import Link from "next/link";
import { ShoppingCart, BellRing, CheckCircle2, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  EmptyState,
} from "@/components/ui/table";
import {
  listAbandonedCarts,
  getAbandonedCartStats,
} from "@/server/services/abandoned-cart.service";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Aguardando",
  NOTIFIED: "Avisado",
  RECOVERED: "Recuperado",
  EXPIRED: "Expirado",
};
const STATUS_TONE: Record<
  string,
  "neutral" | "info" | "warning" | "danger" | "success"
> = {
  PENDING: "warning",
  NOTIFIED: "info",
  RECOVERED: "success",
  EXPIRED: "neutral",
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export default async function CarrinhosAbandonadosPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [carts, stats] = await Promise.all([
    listAbandonedCarts(),
    getAbandonedCartStats(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Carrinhos abandonados"
        description="Clientes que preencheram telefone mas não finalizaram o pedido. Cron envia WhatsApp de recuperação automaticamente (configurável em /configuracoes)."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
              <ShoppingCart className="h-3 w-3" /> Aguardando
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">
              {stats.pending}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
              <BellRing className="h-3 w-3" /> Avisados
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-blue-700">
              {stats.notified}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Recuperados
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-green-700">
              {stats.recovered}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Receita recuperada
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-green-700">
              {fmtBRL(stats.totalRevenue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {carts.length === 0 ? (
        <EmptyState>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <ShoppingCart className="h-8 w-8 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-900">
                Nenhum carrinho abandonado
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Quando alguém preencher telefone no checkout sem finalizar,
                aparece aqui.
              </p>
            </div>
          </div>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Cliente</TH>
              <TH>Telefone</TH>
              <TH>Itens</TH>
              <TH>Total</TH>
              <TH>Status</TH>
              <TH>Abandonado</TH>
              <TH>Avisado</TH>
            </TR>
          </THead>
          <TBody>
            {carts.map((c) => {
              const items = c.itemsSnapshot as unknown as Array<{
                name: string;
                quantity: number;
              }>;
              return (
                <TR key={c.id}>
                  <TD className="font-medium text-slate-900">
                    {c.customerName ?? c.customer?.name ?? "—"}
                  </TD>
                  <TD className="text-xs text-slate-600 font-mono">
                    {c.customerPhone}
                  </TD>
                  <TD className="text-xs text-slate-700 max-w-xs">
                    <span className="line-clamp-2">
                      {items.map((it) => `${it.quantity}× ${it.name}`).join(", ")}
                    </span>
                  </TD>
                  <TD className="tabular-nums text-slate-900">
                    {fmtBRL(Number(c.totalSnapshot))}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[c.status]}>
                      {STATUS_LABEL[c.status]}
                    </Badge>
                    {c.recoveredSaleId && (
                      <Link
                        href={`/vendas/${c.recoveredSaleId}`}
                        className="block text-[10px] text-roxa-700 hover:underline mt-0.5"
                      >
                        Ver venda →
                      </Link>
                    )}
                  </TD>
                  <TD className="text-xs text-slate-600">
                    {fmtDateTime(c.createdAt)}
                  </TD>
                  <TD className="text-xs text-slate-600">
                    {c.notifiedAt ? fmtDateTime(c.notifiedAt) : "—"}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}
