"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { Copy, Eye, EyeOff, Pencil, Power, Trash2 } from "lucide-react";
import {
  deleteProductAction,
  duplicateProductAction,
  setProductActiveAction,
  setProductShowInMenuAction,
} from "@/server/actions/products";

export function ProductRowActions({
  id,
  active,
  showInMenu,
}: {
  id: string;
  active: boolean;
  showInMenu: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      await setProductActiveAction(id, !active);
      router.refresh();
    });
  }

  function toggleMenu() {
    startTransition(async () => {
      const res = await setProductShowInMenuAction(id, !showInMenu);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  function duplicate() {
    startTransition(async () => {
      const res = await duplicateProductAction(id);
      if (!res.ok) window.alert(res.error);
      // server action redirects on success
    });
  }

  function remove() {
    if (
      !window.confirm(
        "Excluir este produto? Só funciona se ele não estiver em combos nem tiver itens na ficha técnica.",
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteProductAction(id);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={toggleMenu}
        disabled={pending}
        className={
          showInMenu
            ? "rounded-md p-1.5 text-roxa-700 hover:bg-roxa-50 disabled:opacity-50"
            : "rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        }
        title={showInMenu ? "No cardápio online — clique para ocultar" : "Não está no cardápio — clique para mostrar"}
      >
        {showInMenu ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
      <Link
        href={`/produtos/${id}`}
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
