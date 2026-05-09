import Link from "next/link";
import { ClipboardCheck, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
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
import { listInventories } from "@/server/services/inventory.service";
import { inventoryListFiltersSchema } from "@/schemas/inventory.schema";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  FECHADA: "Fechada",
  CANCELADA: "Cancelada",
};

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export default async function InventariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = inventoryListFiltersSchema.parse({
    status: typeof params.status === "string" ? params.status : "all",
  });

  const inventories = await listInventories(filters);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventário"
        description="Contagens físicas. Ao fechar, o sistema gera ajustes de estoque automaticamente pra cada divergência."
        actions={
          <Link
            href="/inventarios/nova"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-roxa-700 px-4 text-sm font-medium text-white hover:bg-roxa-800"
          >
            <Plus className="h-4 w-4" />
            Nova contagem
          </Link>
        }
      />

      <form className="flex flex-wrap items-center gap-2" action="/inventarios">
        <Select name="status" defaultValue={filters.status} className="w-44">
          <option value="all">Todos os status</option>
          <option value="ABERTA">Apenas abertas</option>
          <option value="FECHADA">Apenas fechadas</option>
          <option value="CANCELADA">Apenas canceladas</option>
        </Select>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          Filtrar
        </button>
      </form>

      {inventories.length === 0 ? (
        <EmptyState>
          <ClipboardCheck className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          Nenhuma contagem ainda.{" "}
          <Link href="/inventarios/nova" className="text-roxa-700 hover:underline">
            Criar a primeira
          </Link>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nome</TH>
              <TH>Status</TH>
              <TH className="text-center">Itens</TH>
              <TH>Aberto por</TH>
              <TH>Iniciado em</TH>
              <TH>Fechado em</TH>
            </TR>
          </THead>
          <TBody>
            {inventories.map((inv) => (
              <TR key={inv.id}>
                <TD className="font-medium text-slate-900">
                  <Link
                    href={`/inventarios/${inv.id}`}
                    className="hover:text-roxa-700"
                  >
                    {inv.name}
                  </Link>
                  {inv.notes && (
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                      {inv.notes}
                    </p>
                  )}
                </TD>
                <TD>
                  {inv.status === "ABERTA" ? (
                    <Badge tone="info">{STATUS_LABEL[inv.status]}</Badge>
                  ) : inv.status === "FECHADA" ? (
                    <Badge tone="success">{STATUS_LABEL[inv.status]}</Badge>
                  ) : (
                    <Badge tone="neutral">{STATUS_LABEL[inv.status]}</Badge>
                  )}
                </TD>
                <TD className="text-center text-slate-700 tabular-nums">
                  {inv._count.items}
                </TD>
                <TD className="text-slate-600 text-xs">
                  {inv.createdBy.name}
                </TD>
                <TD className="text-slate-600 text-xs">
                  {fmtDateTime(inv.startedAt)}
                </TD>
                <TD className="text-slate-600 text-xs">
                  {inv.closedAt ? fmtDateTime(inv.closedAt) : "—"}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <div className="text-xs text-slate-500">
        {inventories.length} contagem{inventories.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
