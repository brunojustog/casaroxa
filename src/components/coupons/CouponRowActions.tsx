"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { Pencil, Power, Trash2 } from "lucide-react";
import {
  deleteCouponAction,
  setCouponActiveAction,
} from "@/server/actions/coupons";

export function CouponRowActions({
  id,
  active,
  hasUsage,
}: {
  id: string;
  active: boolean;
  hasUsage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      const res = await setCouponActiveAction(id, !active);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  function remove() {
    if (
      !window.confirm(
        "Excluir este cupom? Só funciona se nunca tiver sido usado. Senão, inative.",
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteCouponAction(id);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/cupons/${id}`}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        title="Editar"
      >
        <Pencil className="h-4 w-4" />
      </Link>
      <button
        type="button"
        onClick={toggleActive}
        disabled={pending}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30"
        title={active ? "Inativar" : "Ativar"}
      >
        <Power className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending || hasUsage}
        className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
        title={hasUsage ? "Já foi usado — não pode excluir" : "Excluir"}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
