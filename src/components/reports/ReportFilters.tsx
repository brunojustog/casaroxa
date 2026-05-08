"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import {
  enumOptions,
  INGREDIENT_CATEGORY_LABEL,
  PRODUCT_CATEGORY_LABEL,
} from "@/lib/enums";
import type { ReportFilterKind } from "@/server/services/report.service";

const PRODUCT_CATEGORIES = enumOptions(PRODUCT_CATEGORY_LABEL);
const INGREDIENT_CATEGORIES = enumOptions(INGREDIENT_CATEGORY_LABEL);

export function ReportFilters({
  reportType,
  filters,
}: {
  reportType: string;
  filters: ReportFilterKind[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value.length > 0) next.set(key, value);
    else next.delete(key);
    startTransition(() =>
      router.push(`/relatorios/${reportType}?${next.toString()}`),
    );
  }

  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((f) => {
        switch (f.kind) {
          case "search":
            return (
              <div key={f.key} className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  defaultValue={params.get(f.key) ?? ""}
                  placeholder={f.placeholder}
                  className="pl-8 w-72"
                  onChange={(e) => update(f.key, e.currentTarget.value)}
                />
              </div>
            );
          case "productCategory":
            return (
              <Select
                key={f.key}
                defaultValue={params.get(f.key) ?? ""}
                onChange={(e) => update(f.key, e.currentTarget.value)}
                className="w-48"
              >
                <option value="">Todas categorias</option>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            );
          case "ingredientCategory":
            return (
              <Select
                key={f.key}
                defaultValue={params.get(f.key) ?? ""}
                onChange={(e) => update(f.key, e.currentTarget.value)}
                className="w-48"
              >
                <option value="">Todas categorias</option>
                {INGREDIENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            );
          case "boolean":
            return (
              <label
                key={f.key}
                className="inline-flex items-center gap-2 h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-roxa-700 focus:ring-roxa-500"
                  defaultChecked={params.get(f.key) === "1"}
                  onChange={(e) => update(f.key, e.currentTarget.checked ? "1" : "")}
                />
                {f.label}
              </label>
            );
          case "daterange":
            return (
              <div key={`${f.fromKey}:${f.toKey}`} className="flex items-end gap-2">
                <Field label="De" className="m-0">
                  <Input
                    type="date"
                    defaultValue={params.get(f.fromKey) ?? ""}
                    onChange={(e) => update(f.fromKey, e.currentTarget.value)}
                    className="w-40"
                  />
                </Field>
                <Field label="Até" className="m-0">
                  <Input
                    type="date"
                    defaultValue={params.get(f.toKey) ?? ""}
                    onChange={(e) => update(f.toKey, e.currentTarget.value)}
                    className="w-40"
                  />
                </Field>
              </div>
            );
          case "select":
            return (
              <Select
                key={f.key}
                defaultValue={params.get(f.key) ?? ""}
                onChange={(e) => update(f.key, e.currentTarget.value)}
                className="w-44"
              >
                <option value="">{f.label}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            );
        }
      })}
    </div>
  );
}
