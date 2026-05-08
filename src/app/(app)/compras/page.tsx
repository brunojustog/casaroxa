import Link from "next/link";
import { Plus, Search } from "lucide-react";
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
import {
  PURCHASE_STATUS_LABEL,
  PURCHASE_STATUS_TONE,
  listPurchases,
} from "@/server/services/purchase.service";
import { listActiveSuppliers } from "@/server/services/supplier.service";
import { purchaseListFiltersSchema } from "@/schemas/purchase.schema";
import { formatBRL, formatDate } from "@/lib/format";
import { PurchaseStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = purchaseListFiltersSchema.parse({
    search: typeof params.search === "string" ? params.search : undefined,
    supplierId:
      typeof params.supplierId === "string" && params.supplierId.length > 0
        ? params.supplierId
        : undefined,
    status:
      typeof params.status === "string" && params.status.length > 0
        ? params.status
        : undefined,
  });

  const [purchases, suppliers] = await Promise.all([
    listPurchases(filters),
    listActiveSuppliers(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Compras"
        description="Lançamentos de compras de fornecedores. Confirmar uma compra alimenta o estoque e atualiza o custo dos ingredientes."
        actions={
          <Link
            href="/compras/nova"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-roxa-700 px-4 text-sm font-medium text-white hover:bg-roxa-800"
          >
            <Plus className="h-4 w-4" />
            Nova compra
          </Link>
        }
      />

      <form className="flex flex-wrap items-center gap-2" action="/compras">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            name="search"
            defaultValue={filters.search ?? ""}
            placeholder="Buscar por NF, fornecedor, notas…"
            className="pl-8 w-72"
          />
        </div>
        <Select name="supplierId" defaultValue={filters.supplierId ?? ""} className="w-48">
          <option value="">Todos fornecedores</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={filters.status ?? ""} className="w-44">
          <option value="">Todos status</option>
          {Object.values(PurchaseStatus).map((s) => (
            <option key={s} value={s}>
              {PURCHASE_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          Filtrar
        </button>
      </form>

      {purchases.length === 0 ? (
        <EmptyState>
          Nenhuma compra encontrada.{" "}
          <Link href="/compras/nova" className="text-roxa-700 hover:underline">
            Lançar a primeira
          </Link>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Data</TH>
              <TH>NF</TH>
              <TH>Fornecedor</TH>
              <TH className="text-center">Itens</TH>
              <TH className="text-right">Total</TH>
              <TH>Status</TH>
              <TH className="text-right pr-4"></TH>
            </TR>
          </THead>
          <TBody>
            {purchases.map((p) => (
              <TR key={p.id}>
                <TD className="text-slate-700 whitespace-nowrap">
                  {formatDate(p.invoiceDate)}
                </TD>
                <TD className="text-slate-600 text-xs">
                  {p.invoiceNumber ?? "—"}
                </TD>
                <TD className="font-medium text-slate-900">
                  {p.supplier?.name ?? <span className="text-slate-400">—</span>}
                </TD>
                <TD className="text-center text-slate-700 tabular-nums">
                  {p._count.items}
                </TD>
                <TD className="text-right tabular-nums">
                  {formatBRL(p.totalAmount)}
                </TD>
                <TD>
                  <Badge tone={PURCHASE_STATUS_TONE[p.status]}>
                    {PURCHASE_STATUS_LABEL[p.status]}
                  </Badge>
                </TD>
                <TD className="text-right pr-2">
                  <Link
                    href={`/compras/${p.id}`}
                    className="text-xs font-medium text-roxa-700 hover:underline"
                  >
                    Abrir →
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <div className="text-xs text-slate-500">
        {purchases.length} compra{purchases.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
