import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search, Tag } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  EmptyState,
} from "@/components/ui/table";
import { CouponRowActions } from "@/components/coupons/CouponRowActions";
import { listCoupons } from "@/server/services/coupon.service";
import { couponListFiltersSchema } from "@/schemas/coupon.schema";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtDate = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      }).format(d)
    : "—";

export default async function CuponsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const filters = couponListFiltersSchema.parse({
    search: typeof params.search === "string" ? params.search : undefined,
    active: typeof params.active === "string" ? params.active : "active",
  });

  const coupons = await listCoupons(filters);
  const now = new Date();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cupons de desconto"
        description="Códigos promocionais aplicáveis no checkout do cardápio público."
        actions={
          <Link
            href="/cupons/novo"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-roxa-700 px-4 text-sm font-medium text-white hover:bg-roxa-800"
          >
            <Plus className="h-4 w-4" />
            Novo cupom
          </Link>
        }
      />

      <form className="flex flex-wrap items-center gap-2" action="/cupons">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            name="search"
            defaultValue={filters.search ?? ""}
            placeholder="Buscar por código ou descrição…"
            className="pl-8 w-72"
          />
        </div>
        <Select name="active" defaultValue={filters.active} className="w-36">
          <option value="active">Apenas ativos</option>
          <option value="inactive">Apenas inativos</option>
          <option value="all">Todos</option>
        </Select>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          Filtrar
        </button>
      </form>

      {coupons.length === 0 ? (
        <EmptyState>
          <Tag className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          Nenhum cupom cadastrado.{" "}
          <Link href="/cupons/novo" className="text-roxa-700 hover:underline">
            Criar o primeiro
          </Link>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Código</TH>
              <TH>Tipo / Valor</TH>
              <TH className="text-center">Usos</TH>
              <TH>Validade</TH>
              <TH>Pedido mínimo</TH>
              <TH>Status</TH>
              <TH className="text-right pr-4">Ações</TH>
            </TR>
          </THead>
          <TBody>
            {coupons.map((c) => {
              const expired = c.validUntil && c.validUntil < now;
              const exhausted =
                c.maxUses !== null && c.usedCount >= c.maxUses;
              const value = Number(c.value);
              return (
                <TR key={c.id}>
                  <TD className="font-mono font-semibold text-roxa-900">
                    <Link
                      href={`/cupons/${c.id}`}
                      className="hover:text-roxa-700"
                    >
                      {c.code}
                    </Link>
                    {c.description && (
                      <p className="text-xs text-slate-500 font-sans font-normal mt-0.5 line-clamp-1">
                        {c.description}
                      </p>
                    )}
                  </TD>
                  <TD className="text-slate-700">
                    {c.type === "PERCENT" ? (
                      <span className="font-semibold">{value}% off</span>
                    ) : (
                      <span className="font-semibold">−{fmtBRL(value)}</span>
                    )}
                  </TD>
                  <TD className="text-center text-slate-700 tabular-nums">
                    {c.usedCount}
                    {c.maxUses !== null && (
                      <span className="text-slate-400"> / {c.maxUses}</span>
                    )}
                  </TD>
                  <TD className="text-slate-600 text-xs">
                    {c.validFrom || c.validUntil ? (
                      <span>
                        {fmtDate(c.validFrom)} → {fmtDate(c.validUntil)}
                      </span>
                    ) : (
                      <span className="text-slate-400">sem prazo</span>
                    )}
                  </TD>
                  <TD className="text-slate-600 text-xs tabular-nums">
                    {c.minOrderAmount ? fmtBRL(Number(c.minOrderAmount)) : "—"}
                  </TD>
                  <TD>
                    {!c.active ? (
                      <Badge tone="neutral">Inativo</Badge>
                    ) : expired ? (
                      <Badge tone="danger">Expirado</Badge>
                    ) : exhausted ? (
                      <Badge tone="warning">Esgotado</Badge>
                    ) : (
                      <Badge tone="success">Ativo</Badge>
                    )}
                  </TD>
                  <TD className="text-right pr-2">
                    <CouponRowActions
                      id={c.id}
                      active={c.active}
                      hasUsage={c._count.sales > 0}
                    />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <div className="text-xs text-slate-500">
        {coupons.length} cupom{coupons.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
