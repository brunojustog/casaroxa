import Link from "next/link";
import { Award, ChevronRight, Gift, ShoppingBag, Tag, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAuthedCustomer } from "@/server/services/customer-session.service";
import { LOYALTY_RULE } from "@/server/services/loyalty.service";
import { listRafflesForCustomer } from "@/server/services/raffle.service";
import { MyOrdersLogin } from "@/components/public/auth/MyOrdersLogin";
import { CouponCopyButton } from "@/components/public/auth/CouponCopyButton";
import { LogoutButton } from "@/components/public/auth/LogoutButton";

export const dynamic = "force-dynamic";

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

const STATUS_LABEL: Record<string, string> = {
  ABERTA: "Em andamento",
  CONCLUIDA: "Concluído",
  CANCELADA: "Cancelado",
};

const PROGRESS_LABEL: Record<string, string> = {
  NOVO: "Recebido",
  CONFIRMADO: "Confirmado",
  PREPARANDO: "Preparando",
  PRONTO: "Pronto",
  SAIU_ENTREGA: "Saiu pra entrega",
  ENTREGUE: "Entregue",
};

export default async function MyOrdersPage() {
  const customer = await getAuthedCustomer();

  // Sem sessão: mostra tela de login OTP
  if (!customer) {
    return (
      <div className="mx-auto max-w-md py-10">
        <div className="rounded-xl border border-roxa-100 bg-white p-6 shadow-sm">
          <h1 className="font-serif text-2xl font-bold text-roxa-900">
            Meus pedidos
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Identifique-se com seu número de WhatsApp pra ver o histórico de
            pedidos e cupons disponíveis.
          </p>
          <MyOrdersLogin />
        </div>
      </div>
    );
  }

  // Busca pedidos + cupons + sorteios do cliente
  const [sales, coupons, raffleEntries] = await Promise.all([
    prisma.sale.findMany({
      where: { customerId: customer.id },
      orderBy: { occurredAt: "desc" },
      take: 20,
      select: {
        id: true,
        number: true,
        occurredAt: true,
        status: true,
        progress: true,
        totalRevenue: true,
        couponDiscount: true,
        couponCode: true,
        source: true,
      },
    }),
    // Cupons "do cliente" — descontos fidelidade (FID_) e aniversário (ANIVER_)
    // criados pra ele. Como hoje não vinculamos por customerId, filtramos pela
    // descrição (que inclui nome ou customerId).
    prisma.coupon.findMany({
      where: {
        active: true,
        validUntil: { gte: new Date() },
        usedCount: 0,
        OR: [
          { description: { contains: customer.id } },
          { description: { contains: customer.name, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    listRafflesForCustomer(customer.id),
  ]);

  const totalSpent = sales
    .filter((s) => s.status === "CONCLUIDA")
    .reduce(
      (acc, s) => acc + Number(s.totalRevenue) - Number(s.couponDiscount),
      0,
    );

  return (
    <div className="mx-auto max-w-2xl py-6 space-y-5 px-3">
      <header>
        <h1 className="font-serif text-3xl font-bold text-roxa-900">
          Meus pedidos
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Olá <strong>{customer.name.split(/\s+/)[0]}</strong>! Aqui você
          acompanha tudo que pediu.
        </p>
      </header>

      {/* Cards: Total gasto + Pontos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-roxa-100 bg-white p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">
            Total já gasto
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-roxa-900">
            {fmtBRL(totalSpent)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {sales.length} pedido{sales.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-amber-800 inline-flex items-center gap-1">
            <Award className="h-3 w-3" />
            Cartão fidelidade
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">
            {customer.loyaltyPoints}
            <span className="text-sm font-normal text-amber-800"> pts</span>
          </p>
          {customer.loyaltyPoints < LOYALTY_RULE.redeemThreshold ? (
            <p className="mt-1 text-[11px] text-amber-800">
              Faltam {LOYALTY_RULE.redeemThreshold - customer.loyaltyPoints} pra{" "}
              {fmtBRL(LOYALTY_RULE.redeemValueReais)} off
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-green-700">
              ✓ Pronto pra resgatar!
            </p>
          )}
        </div>
      </div>

      {/* Cupons ativos */}
      {coupons.length > 0 && (
        <section className="rounded-xl border border-green-200 bg-green-50/50 p-4 shadow-sm">
          <h2 className="font-serif text-base font-semibold text-green-900 inline-flex items-center gap-1.5">
            <Tag className="h-4 w-4" />
            Cupons disponíveis pra você
          </h2>
          <p className="text-xs text-green-800 mt-0.5">
            Use no próximo pedido — é só digitar o código no checkout.
          </p>
          <ul className="mt-3 space-y-2">
            {coupons.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-md border border-green-200 bg-white px-3 py-2"
              >
                <div>
                  <p className="font-mono text-sm font-bold text-green-900">
                    {c.code}
                  </p>
                  <p className="text-[11px] text-green-800">
                    {c.type === "PERCENT"
                      ? `${Number(c.value)}% off`
                      : `${fmtBRL(Number(c.value))} de desconto`}
                    {c.validUntil &&
                      ` · até ${c.validUntil.toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                <CouponCopyButton code={c.code} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Meus sorteios */}
      {raffleEntries.length > 0 && (
        <section>
          <h2 className="font-serif text-lg font-semibold text-roxa-900 mb-2 inline-flex items-center gap-1.5">
            <Gift className="h-4 w-4" />
            Meus sorteios
          </h2>
          <ul className="divide-y divide-roxa-50 rounded-xl border border-roxa-100 bg-white shadow-sm">
            {raffleEntries.map((e) => {
              const myPrize = e.raffle.prizes.find(
                (p) => p.winnerEntryId === e.id,
              );
              const won = Boolean(myPrize);
              return (
                <li key={e.id}>
                  <Link
                    href={`/sorteio/${e.raffle.id}`}
                    className="flex items-center gap-3 p-4 hover:bg-roxa-50/30"
                  >
                    <div
                      className={
                        won
                          ? "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700"
                          : "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500"
                      }
                    >
                      {won ? (
                        <Trophy className="h-4 w-4" />
                      ) : (
                        <Gift className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">
                        {e.raffle.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Seu número:{" "}
                        <span className="font-mono font-semibold text-amber-700">
                          #{e.number}
                        </span>
                        {e.raffle.status === "DRAWN"
                          ? won
                            ? " · 🏆 VOCÊ GANHOU!"
                            : " · Sorteio realizado"
                          : e.raffle.status === "OPEN"
                            ? " · Aguardando sorteio"
                            : ""}
                      </p>
                      {won && myPrize && (
                        <p className="mt-1 text-xs font-medium text-amber-800">
                          🏆 {myPrize.position}º lugar · 🎁 {myPrize.description}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Pedidos */}
      <section>
        <h2 className="font-serif text-lg font-semibold text-roxa-900 mb-2 inline-flex items-center gap-1.5">
          <ShoppingBag className="h-4 w-4" />
          Histórico
        </h2>
        {sales.length === 0 ? (
          <div className="rounded-xl border border-dashed border-roxa-200 bg-white p-6 text-center text-sm text-slate-500">
            Você ainda não fez nenhum pedido.{" "}
            <Link href="/cardapio" className="text-roxa-700 hover:underline">
              Ver cardápio
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-roxa-50 rounded-xl border border-roxa-100 bg-white shadow-sm">
            {sales.map((s) => {
              const total =
                Number(s.totalRevenue) - Number(s.couponDiscount);
              const isCancelled = s.status === "CANCELADA";
              return (
                <li key={s.id}>
                  <Link
                    href={`/pedido/${s.id}`}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-roxa-50/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">
                        Pedido #{s.number}
                      </p>
                      <p className="text-xs text-slate-500">
                        {fmtDateTime(s.occurredAt)}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className={
                            isCancelled
                              ? "inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700"
                              : s.status === "CONCLUIDA"
                                ? "inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700"
                                : "inline-block rounded-full bg-roxa-100 px-2 py-0.5 text-[10px] font-medium text-roxa-700"
                          }
                        >
                          {STATUS_LABEL[s.status]}
                          {!isCancelled && s.status === "ABERTA"
                            ? ` · ${PROGRESS_LABEL[s.progress] ?? s.progress}`
                            : ""}
                        </span>
                        {s.couponCode && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            <Tag className="h-2.5 w-2.5" />
                            {s.couponCode}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold tabular-nums text-slate-900">
                        {fmtBRL(total)}
                      </p>
                      <ChevronRight className="ml-auto mt-1 h-4 w-4 text-slate-400" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="text-center pt-2">
        <Link
          href="/cardapio"
          className="inline-flex items-center gap-1 text-sm font-medium text-roxa-700 hover:underline"
        >
          ← Voltar ao cardápio
        </Link>
      </div>

      <div className="pt-2 text-center">
        <LogoutButton />
      </div>
    </div>
  );
}
