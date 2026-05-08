"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { Pencil, Power, Trash2 } from "lucide-react";
import {
  deleteSupplierAction,
  setSupplierActiveAction,
} from "@/server/actions/suppliers";

export function SupplierRowActions({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      await setSupplierActiveAction(id, !active);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Excluir este fornecedor? Só funciona se não tiver compras associadas."))
      return;
    startTransition(async () => {
      const res = await deleteSupplierAction(id);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/fornecedores/${id}`}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        title="Editar"
      >
        <Pencil className="h-4 w-4" />
      </Link>
      <button
        type="button"
        onClick={toggleActive}
        disabled={pending}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
        title={active ? "Inativar" : "Ativar"}
      >
        <Power className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        title="Excluir"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
