"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function StockFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value.length > 0) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/estoque?${next.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          defaultValue={params.get("search") ?? ""}
          placeholder="Buscar ingrediente…"
          className="pl-8 w-72"
          onChange={(e) => update("search", e.currentTarget.value)}
        />
      </div>

      <Select
        defaultValue={params.get("filter") ?? "all"}
        onChange={(e) => update("filter", e.currentTarget.value)}
        className="w-56"
      >
        <option value="all">Todos os ingredientes</option>
        <option value="below_min">Abaixo do estoque mínimo</option>
        <option value="expiring">Vencendo em 7 dias</option>
        <option value="empty">Saldo zerado mas usado em ficha</option>
      </Select>
    </div>
  );
}
