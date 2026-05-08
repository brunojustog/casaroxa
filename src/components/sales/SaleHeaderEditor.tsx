"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { SaleSource } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { SALE_SOURCE_LABEL, enumOptions } from "@/lib/enums";
import { updateSaleHeaderAction } from "@/server/actions/sales";

const SOURCE_OPTIONS = enumOptions(SALE_SOURCE_LABEL);

function toLocalDateTimeValue(d: Date): string {
  const local = new Date(d);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

export function SaleHeaderEditor({
  saleId,
  initial,
  readOnly,
}: {
  saleId: string;
  initial: {
    occurredAt: Date;
    source: SaleSource;
    customerName: string | null;
    notes: string | null;
  };
  readOnly: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [state, setState] = useState({
    occurredAt: toLocalDateTimeValue(initial.occurredAt),
    source: initial.source,
    customerName: initial.customerName ?? "",
    notes: initial.notes ?? "",
  });

  function set<K extends keyof typeof state>(k: K, v: typeof state[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await updateSaleHeaderAction(saleId, state);
      if (!res.ok) setMsg({ type: "err", text: res.error });
      else {
        setMsg({ type: "ok", text: "Cabeçalho salvo." });
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Data e hora">
          <Input
            type="datetime-local"
            value={state.occurredAt}
            onChange={(e) => set("occurredAt", e.currentTarget.value)}
            disabled={readOnly}
          />
        </Field>
        <Field label="Origem">
          <Select
            value={state.source}
            onChange={(e) => set("source", e.currentTarget.value as SaleSource)}
            disabled={readOnly}
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Cliente (opcional)">
        <Input
          value={state.customerName}
          onChange={(e) => set("customerName", e.currentTarget.value)}
          disabled={readOnly}
        />
      </Field>
      <Field label="Observações">
        <Textarea
          rows={2}
          value={state.notes}
          onChange={(e) => set("notes", e.currentTarget.value)}
          disabled={readOnly}
        />
      </Field>

      {msg && (
        <div
          className={
            msg.type === "ok"
              ? "rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700"
              : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          }
        >
          {msg.text}
        </div>
      )}

      {!readOnly && (
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isPending}>
            <Save className="h-3.5 w-3.5" />
            {isPending ? "Salvando…" : "Salvar cabeçalho"}
          </Button>
        </div>
      )}
    </form>
  );
}
