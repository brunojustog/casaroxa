import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, Cake, ChevronLeft, MessageCircle, Phone, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { getCustomerWithSales } from "@/server/services/customer.service";
import { LOYALTY_RULE } from "@/server/services/loyalty.service";
import { whatsappLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const fmtPhone = (p: string) => {
  const digits = p.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return p;
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

const fmtBirthday = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  }).format(d);

const STATUS_LABEL: Record<string, string> = {
  ABERTA: "Em aberto",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCustomerWithSales(id);
  if (!c) notFound();

  const totalSpent = c.sales
    .filter((s) => s.status === "CONCLUIDA")
    .reduce((acc, s) => acc + Number(s.totalRevenue) - Number(s.couponDiscount), 0);

  const wa = whatsappLink(
    c.phone,
    `Olá ${c.name}! Aqui é da Casa Roxa.`,
  );

  return (
    <div className="space-y-5">
      <Link
        href="/clientes"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para clientes
      </Link>

      <PageHeader
        title={c.name}
        description={
          <span className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              {fmtPhone(c.phone)}
            </span>
            {c.birthday && (
              <span className="inline-flex items-center gap-1 text-roxa-700">
                <Cake className="h-3.5 w-3.5" />
                {fmtBirthday(c.birthday)}
              </span>
            )}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-green-600 px-3 text-sm font-medium text-white hover:bg-green-700"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            )}
            {c.active ? (
              <Badge tone="success">Ativo</Badge>
            ) : (
              <Badge tone="neutral">Inativo</Badge>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-4">
                Dados do cliente
              </h2>
              <CustomerForm
                mode={{ type: "edit", id: c.id }}
                defaultValues={{
                  name: c.name,
                  phone: c.phone,
                  email: c.email,
                  birthday: c.birthday,
                  address: c.address,
                  addressNumber: c.addressNumber,
                  addressComplement: c.addressComplement,
                  neighborhood: c.neighborhood,
                  reference: c.reference,
                  notes: c.notes,
                  active: c.active,
                }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Total gasto (concluídos)
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-roxa-900">
                {fmtBRL(totalSpent)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {c.sales.length} pedido{c.sales.length === 1 ? "" : "s"} no total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
                <Award className="h-3 w-3 text-amber-500" />
                Cartão fidelidade
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-700">
                {c.loyaltyPoints} <span className="text-sm font-normal text-slate-500">pts</span>
              </p>
              {c.loyaltyPoints >= LOYALTY_RULE.redeemThreshold ? (
                <p className="mt-1 text-xs text-green-700 inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Pronto pra resgatar!
                </p>
              ) : (
                <>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{
                        width: `${Math.min(100, (c.loyaltyPoints / LOYALTY_RULE.redeemThreshold) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Faltam <strong>{LOYALTY_RULE.redeemThreshold - c.loyaltyPoints}</strong>{" "}
                    pts pra próximo resgate de {fmtBRL(LOYALTY_RULE.redeemValueReais)}
                  </p>
                </>
              )}
              <p className="mt-2 text-[11px] text-slate-400">
                Regra: 1 pt por R$ 1 gasto. {LOYALTY_RULE.redeemThreshold} pts ={" "}
                {fmtBRL(LOYALTY_RULE.redeemValueReais)} de desconto.
              </p>
            </CardContent>
          </Card>

          {c.loyaltyTransactions.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                  Histórico de pontos
                </p>
                <ul className="space-y-1 text-xs">
                  {c.loyaltyTransactions.slice(0, 8).map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-slate-600">
                        {fmtDateTime(t.createdAt)}
                        {" · "}
                        <span
                          className={
                            t.type === "EARN"
                              ? "text-green-700"
                              : t.type === "REDEEM"
                                ? "text-amber-700"
                                : "text-slate-700"
                          }
                        >
                          {t.type === "EARN" && "+ ganho"}
                          {t.type === "REDEEM" && "- resgate"}
                          {t.type === "ADJUST" && "ajuste"}
                        </span>
                      </span>
                      <span
                        className={`font-mono font-semibold tabular-nums ${
                          t.type === "EARN"
                            ? "text-green-700"
                            : "text-amber-700"
                        }`}
                      >
                        {t.type === "EARN" ? "+" : "−"}
                        {t.points}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-3">
            Histórico de pedidos
          </h2>
          {c.sales.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              Sem pedidos ainda.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {c.sales.map((s) => {
                const total =
                  Number(s.totalRevenue) - Number(s.couponDiscount);
                return (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div>
                      <Link
                        href={`/vendas/${s.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-roxa-700"
                      >
                        Pedido #{s.number}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {fmtDateTime(s.occurredAt)} · {s.source}
                        {s.couponCode && ` · cupom ${s.couponCode}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        tone={
                          s.status === "CONCLUIDA"
                            ? "success"
                            : s.status === "CANCELADA"
                              ? "danger"
                              : "info"
                        }
                      >
                        {STATUS_LABEL[s.status]}
                      </Badge>
                      <span className="text-sm font-semibold tabular-nums text-slate-900 w-24 text-right">
                        {fmtBRL(total)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
