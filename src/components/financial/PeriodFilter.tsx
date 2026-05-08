"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

export function PeriodFilter({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: "from" | "to", value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value.length > 0) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/resultado?${next.toString()}`));
  }

  function setMonthOffset(offset: number) {
    const today = new Date();
    const ref = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const next = new URLSearchParams();
    next.set("from", start.toISOString().slice(0, 10));
    next.set("to", end.toISOString().slice(0, 10));
    startTransition(() => router.push(`/resultado?${next.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="De" className="m-0">
        <Input
          type="date"
          defaultValue={defaultFrom}
          onChange={(e) => update("from", e.currentTarget.value)}
          className="w-40"
        />
      </Field>
      <Field label="Até" className="m-0">
        <Input
          type="date"
          defaultValue={defaultTo}
          onChange={(e) => update("to", e.currentTarget.value)}
          className="w-40"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-1.5 ml-2">
        <PresetButton onClick={() => setMonthOffset(0)}>Mês atual</PresetButton>
        <PresetButton onClick={() => setMonthOffset(-1)}>Mês passado</PresetButton>
        <PresetButton onClick={() => setMonthOffset(-2)}>2 meses atrás</PresetButton>
      </div>
    </div>
  );
}

function PresetButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-300"
    >
      {children}
    </button>
  );
}
