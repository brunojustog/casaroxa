import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plus, AlertTriangle, PackageX } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  getIngredient,
  getStockBalance,
  listMovementsByIngredient,
} from "@/server/services/stock.service";
import {
  STOCK_MOVEMENT_TYPE_LABEL,
  STOCK_MOVEMENT_TYPE_TONE,
} from "@/lib/stock-enums";
import {
  INGREDIENT_CATEGORY_LABEL,
  INGREDIENT_UNIT_LABEL,
} from "@/lib/enums";
import { formatBRL, formatDate, formatDateTime, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function IngredientStockPage({
  params,
}: {
  params: Promise<{ ingredientId: string }>;
}) {
  const { ingredientId } = await params;

  const [ingredient, balance, movements] = await Promise.all([
    getIngredient(ingredientId),
    getStockBalance(ingredientId),
    listMovementsByIngredient(ingredientId, 100),
  ]);

  if (!ingredient) notFound();

  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Próxima validade
  const futureExpiries = movements
    .filter((m) => m.expiryDate && m.expiryDate >= now)
    .map((m) => m.expiryDate as Date)
    .sort((a, b) => a.getTime() - b.getTime());
  const nextExpiry = futureExpiries[0] ?? null;
  const expiresSoon = nextExpiry && nextExpiry <= sevenDays;

  return (
    <div className="space-y-5">
      <Link
        href="/estoque"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para estoque
      </Link>

      <PageHeader
        title={ingredient.name}
        description={`${INGREDIENT_CATEGORY_LABEL[ingredient.category]} · custo cadastrado ${formatBRL(ingredient.unitCost)} por ${INGREDIENT_UNIT_LABEL[ingredient.unit]}`}
        actions={
          <Link
            href={`/estoque/lancar?ingredientId=${ingredient.id}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-roxa-700 px-4 text-sm font-medium text-white hover:bg-roxa-800"
          >
            <Plus className="h-4 w-4" />
            Lançar movimento
          </Link>
        }
      />

      {/* Resumo */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="Saldo atual"
          value={`${formatNumber(balance)} ${INGREDIENT_UNIT_LABEL[ingredient.unit]}`}
          accent={balance <= 0 ? "danger" : "ok"}
        />
        <SummaryCard
          label="Valor em estoque"
          value={
            balance > 0
              ? formatBRL(balance * Number(ingredient.unitCost))
              : "—"
          }
        />
        <SummaryCard
          label="Próxima validade"
          value={nextExpiry ? formatDate(nextExpiry) : "—"}
          accent={expiresSoon ? "warning" : "neutral"}
        />
        <SummaryCard
          label="Movimentos registrados"
          value={String(movements.length)}
        />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {balance <= 0 && (
          <Badge tone="danger">
            <PackageX className="h-3 w-3" /> sem saldo
          </Badge>
        )}
        {expiresSoon && (
          <Badge tone="warning">
            <AlertTriangle className="h-3 w-3" /> vence em ≤ 7 dias
          </Badge>
        )}
        {!ingredient.active && <Badge tone="neutral">Ingrediente inativo</Badge>}
      </div>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de movimentos</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <EmptyState>
              Nenhum movimento registrado para este ingrediente.{" "}
              <Link
                href={`/estoque/lancar?ingredientId=${ingredient.id}`}
                className="text-roxa-700 hover:underline"
              >
                Registrar primeiro
              </Link>
            </EmptyState>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Data</TH>
                  <TH>Tipo</TH>
                  <TH className="text-right">Quantidade</TH>
                  <TH className="text-right">Custo unit.</TH>
                  <TH>Lote</TH>
                  <TH>Validade</TH>
                  <TH>Usuário</TH>
                  <TH>Notas</TH>
                </TR>
              </THead>
              <TBody>
                {movements.map((m) => (
                  <TR key={m.id}>
                    <TD className="text-slate-600 text-xs whitespace-nowrap">
                      {formatDateTime(m.createdAt)}
                    </TD>
                    <TD>
                      <Badge tone={STOCK_MOVEMENT_TYPE_TONE[m.type]}>
                        {STOCK_MOVEMENT_TYPE_LABEL[m.type]}
                      </Badge>
                    </TD>
                    <TD className="text-right tabular-nums font-medium">
                      {m.type === "SAIDA" || m.type === "PERDA" ? "−" : "+"}
                      {formatNumber(m.quantity)}{" "}
                      <span className="text-xs text-slate-400">
                        {INGREDIENT_UNIT_LABEL[ingredient.unit]}
                      </span>
                    </TD>
                    <TD className="text-right tabular-nums text-slate-500">
                      {m.unitCost ? formatBRL(m.unitCost) : "—"}
                    </TD>
                    <TD className="text-xs text-slate-600">{m.lotNumber ?? "—"}</TD>
                    <TD className="text-xs text-slate-600">
                      {m.expiryDate ? formatDate(m.expiryDate) : "—"}
                    </TD>
                    <TD className="text-xs text-slate-500">
                      {m.user?.name ?? "—"}
                    </TD>
                    <TD className="text-xs text-slate-500 max-w-[260px] truncate" title={m.notes ?? ""}>
                      {m.notes ?? "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: string;
  accent?: "ok" | "warning" | "danger" | "neutral";
}) {
  const valueColor =
    accent === "danger"
      ? "text-red-700"
      : accent === "warning"
        ? "text-orange-700"
        : accent === "ok"
          ? "text-green-700"
          : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1.5 text-xl font-bold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  );
}
