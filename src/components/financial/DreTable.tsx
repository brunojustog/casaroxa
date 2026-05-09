import { formatBRL, formatPercent } from "@/lib/format";
import type { DrePeriod } from "@/server/services/financial.service";

type Tone = "default" | "muted" | "subtotal" | "total";

function Row({
  label,
  value,
  pct,
  tone = "default",
  hint,
  signed,
}: {
  label: string;
  value: number;
  pct?: number | null;
  tone?: Tone;
  hint?: string;
  signed?: "+" | "-" | "=";
}) {
  const toneStyles =
    tone === "total"
      ? "text-base font-semibold text-slate-900 border-t-2 border-slate-300 pt-2"
      : tone === "subtotal"
        ? "font-medium text-slate-900 border-t border-slate-200 pt-2"
        : tone === "muted"
          ? "text-slate-500 text-sm"
          : "text-slate-700 text-sm";

  const valueColor =
    tone === "total" && value < 0
      ? "text-red-600"
      : tone === "total" && value > 0
        ? "text-green-700"
        : "";

  return (
    <div className={`flex items-baseline justify-between gap-3 ${toneStyles}`}>
      <span className="flex items-baseline gap-2">
        {signed && (
          <span className="text-slate-400 font-mono text-xs w-3 text-center">
            {signed}
          </span>
        )}
        <span>
          {label}
          {hint && (
            <span className="ml-2 text-xs font-normal text-slate-400">
              {hint}
            </span>
          )}
        </span>
      </span>
      <span className="flex items-baseline gap-3">
        {pct !== undefined && pct !== null && (
          <span className="text-xs text-slate-400 tabular-nums w-14 text-right">
            {formatPercent(pct)}
          </span>
        )}
        <span className={`tabular-nums ${valueColor}`}>{formatBRL(value)}</span>
      </span>
    </div>
  );
}

export function DreTable({ dre }: { dre: DrePeriod }) {
  return (
    <div className="space-y-1.5">
      <Row
        label="Receita bruta"
        value={dre.revenue}
        signed="+"
        hint={`${dre.salesCount} venda${dre.salesCount === 1 ? "" : "s"}`}
      />
      <Row
        label="Taxas (cartão / app)"
        value={-dre.fees}
        signed="-"
        tone="muted"
      />
      {dre.couponDiscount > 0 && (
        <Row
          label="Descontos de cupom"
          value={-dre.couponDiscount}
          signed="-"
          tone="muted"
        />
      )}
      {dre.discount > 0 && (
        <Row
          label="Descontos / cortesia"
          value={-dre.discount}
          signed="-"
          tone="muted"
        />
      )}
      <Row
        label="Receita líquida"
        value={dre.netRevenue}
        signed="="
        tone="subtotal"
      />
      <Row
        label="Custo dos produtos vendidos (CMV)"
        value={-dre.cogs}
        pct={dre.cmvPct}
        signed="-"
      />
      <Row
        label="Margem bruta"
        value={dre.grossMargin}
        pct={dre.grossMarginPct}
        signed="="
        tone="subtotal"
      />
      <Row
        label="Custos fixos"
        value={-dre.fixedCosts}
        signed="-"
        hint={`pro-rata ${dre.days} dia${dre.days === 1 ? "" : "s"}`}
      />
      <Row
        label="Resultado operacional"
        value={dre.operatingResult}
        pct={dre.operatingResultPct}
        signed="="
        tone="total"
      />
    </div>
  );
}
