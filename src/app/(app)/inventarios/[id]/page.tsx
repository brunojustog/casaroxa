import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { InventorySession } from "@/components/inventories/InventorySession";
import { getInventoryById } from "@/server/services/inventory.service";
import { getActiveIngredientsForStock } from "@/server/services/stock.service";

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

export default async function InventarioDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inv = await getInventoryById(id);
  if (!inv) notFound();

  const allIngredients = await getActiveIngredientsForStock();
  const inUse = new Set(inv.items.map((it) => it.ingredientId));
  const available = allIngredients
    .filter((ing) => !inUse.has(ing.id))
    .map((ing) => ({
      id: ing.id,
      name: ing.name,
      unit: ing.unit,
      category: ing.category,
    }));

  const items = inv.items.map((it) => ({
    id: it.id,
    ingredientId: it.ingredientId,
    ingredientName: it.ingredient.name,
    ingredientUnit: it.ingredient.unit,
    expectedQuantity: Number(it.expectedQuantity),
    countedQuantity: it.countedQuantity === null ? null : Number(it.countedQuantity),
    unitCostSnapshot: Number(it.unitCostSnapshot),
    notes: it.notes,
    countedByName: it.countedBy?.name ?? null,
  }));

  return (
    <div className="space-y-5">
      <Link
        href="/inventarios"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para inventário
      </Link>

      <PageHeader
        title={inv.name}
        description={
          <span className="text-sm text-slate-600">
            Iniciado por {inv.createdBy.name} em {fmtDateTime(inv.startedAt)}
            {inv.closedAt &&
              ` · Fechado por ${inv.closedBy?.name ?? "—"} em ${fmtDateTime(inv.closedAt)}`}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/inventarios/${inv.id}/print`}
              target="_blank"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              title="Abrir lista pra impressão (offline)"
            >
              <Printer className="h-4 w-4" />
              Imprimir lista
            </Link>
            {inv.status === "ABERTA" ? (
              <Badge tone="info">{STATUS_LABEL[inv.status]}</Badge>
            ) : inv.status === "FECHADA" ? (
              <Badge tone="success">{STATUS_LABEL[inv.status]}</Badge>
            ) : (
              <Badge tone="neutral">{STATUS_LABEL[inv.status]}</Badge>
            )}
          </div>
        }
      />

      {inv.notes && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {inv.notes}
        </div>
      )}

      <InventorySession
        inventoryId={inv.id}
        status={inv.status}
        items={items}
        availableIngredients={available}
      />
    </div>
  );
}
