"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { Copy, Pencil, Power, Trash2 } from "lucide-react";
import {
  deleteComboAction,
  duplicateComboAction,
  setComboActiveAction,
} from "@/server/actions/combos";

export function ComboRowActions({
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
      await setComboActiveAction(id, !active);
      router.refresh();
    });
  }

  function duplicate() {
    startTransition(async () => {
      const res = await duplicateComboAction(id);
      if (!res.ok) window.alert(res.error);
    });
  }

  function remove() {
    if (!window.confirm("Excluir este combo? Esta ação não pode ser desfeita.")) return;
    startTransition(async () => {
      const res = await deleteComboAction(id);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/combos/${id}`}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        title="Editar"
      >
        <Pencil className="h-4 w-4" />
      </Link>
      <button
        type="button"
        onClick={duplicate}
        disabled={pending}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
        title="Duplicar"
      >
        <Copy className="h-4 w-4" />
      </button>
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
