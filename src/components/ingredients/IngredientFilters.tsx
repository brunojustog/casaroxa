"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { enumOptions, INGREDIENT_CATEGORY_LABEL } from "@/lib/enums";

const CATEGORIES = enumOptions(INGREDIENT_CATEGORY_LABEL);

export function IngredientFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value.length > 0) next.set(key, value);
    else next.delete(key);
    startTransition(() => {
      router.push(`/ingredientes?${next.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          defaultValue={params.get("search") ?? ""}
          placeholder="Buscar por nome, fornecedor ou marca…"
          className="pl-8 w-72"
          onChange={(e) => update("search", e.currentTarget.value)}
        />
      </div>

      <Select
        defaultValue={params.get("category") ?? ""}
        onChange={(e) => update("category", e.currentTarget.value)}
        className="w-48"
      >
        <option value="">Todas as categorias</option>
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>

      <Select
        defaultValue={params.get("active") ?? "active"}
        onChange={(e) => update("active", e.currentTarget.value)}
        className="w-36"
      >
        <option value="active">Apenas ativos</option>
        <option value="inactive">Apenas inativos</option>
        <option value="all">Todos</option>
      </Select>
    </div>
  );
}
