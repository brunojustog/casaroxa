"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ReprintCupomButton } from "@/components/sales/ReprintCupomButton";
import { formatBRL } from "@/lib/format";

export type SalesTableRow = {
  id: string;
  number: number;
  dateLabel: string;
  sourceLabel: string;
  customerName: string | null;
  itemCount: number;
  bruto: number;
  liquido: number;
  desconto: number;
  status: string;
  statusLabel: string;
  tone: "success" | "info" | "neutral";
  items: {
    id: string;
    qtyLabel: string;
    name: string;
    unitPrice: number;
    totalPrice: number;
    isCombo: boolean;
  }[];
  payments: { label: string; amount: number }[];
};

/**
 * Tabela de vendas com linhas expansíveis (cascata): clique na linha
 * mostra itens, preço por item, pagamentos e desconto — sem sair da lista.
 */
export function SalesTable({ rows }: { rows: SalesTableRow[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH className="w-8"> </TH>
          <TH className="w-16">#</TH>
          <TH>Data</TH>
          <TH>Origem</TH>
          <TH>Cliente</TH>
          <TH className="text-center">Itens</TH>
          <TH className="text-right">Bruto</TH>
          <TH className="text-right">Líquido</TH>
          <TH>Status</TH>
          <TH className="w-10"> </TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((s) => {
          const isOpen = open.has(s.id);
          return [
            <TR
              key={s.id}
              onClick={() => toggle(s.id)}
              className="cursor-pointer hover:bg-roxa-50/40"
            >
              <TD>
                <ChevronDown
                  className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180 text-roxa-600" : ""}`}
                />
              </TD>
              <TD className="text-slate-500 tabular-nums text-xs">#{s.number}</TD>
              <TD className="text-slate-700 text-xs">{s.dateLabel}</TD>
              <TD className="text-slate-600 text-xs">{s.sourceLabel}</TD>
              <TD className="text-slate-700">{s.customerName ?? "—"}</TD>
              <TD className="text-center text-slate-700 tabular-nums">{s.itemCount}</TD>
              <TD className="text-right tabular-nums">{formatBRL(s.bruto)}</TD>
              <TD className="text-right tabular-nums font-medium text-slate-900">
                {formatBRL(s.liquido)}
              </TD>
              <TD>
                <Badge tone={s.tone}>{s.statusLabel}</Badge>
              </TD>
              <TD onClick={(e) => e.stopPropagation()}>
                {s.status !== "CANCELADA" && (
                  <ReprintCupomButton saleId={s.id} compact />
                )}
              </TD>
            </TR>,
            isOpen ? (
              <TR key={`${s.id}-detail`} className="bg-slate-50/70">
                <TD colSpan={10} className="px-6 py-3">
                  {s.items.length === 0 ? (
                    <p className="text-xs text-slate-500">Venda sem itens.</p>
                  ) : (
                    <div className="space-y-1">
                      {s.items.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-baseline justify-between gap-3 text-sm"
                        >
                          <span className="text-slate-700">
                            {it.qtyLabel} {it.name}
                            {it.isCombo && (
                              <span className="ml-1.5 text-[10px] font-semibold uppercase text-roxa-500">
                                combo
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 tabular-nums text-slate-500">
                            {formatBRL(it.unitPrice)}/un ·{" "}
                            <span className="font-medium text-slate-800">
                              {formatBRL(it.totalPrice)}
                            </span>
                          </span>
                        </div>
                      ))}
                      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-200 pt-2 text-xs">
                        <span className="flex flex-wrap gap-3 text-slate-500">
                          {s.payments.map((p, i) => (
                            <span key={i}>
                              {p.label}:{" "}
                              <span className="font-medium tabular-nums text-slate-700">
                                {formatBRL(p.amount)}
                              </span>
                            </span>
                          ))}
                          {s.desconto > 0 && (
                            <span className="font-semibold text-amber-700">
                              Desconto: {formatBRL(s.desconto)}
                            </span>
                          )}
                        </span>
                        <Link
                          href={`/vendas/${s.id}`}
                          className="inline-flex items-center gap-1 font-medium text-roxa-700 hover:underline"
                        >
                          Abrir venda completa
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  )}
                </TD>
              </TR>
            ) : null,
          ];
        })}
      </TBody>
    </Table>
  );
}
