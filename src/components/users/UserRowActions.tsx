"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { Pencil, Power, Trash2 } from "lucide-react";
import {
  deleteUserAction,
  setUserActiveAction,
} from "@/server/actions/users";

export function UserRowActions({
  id,
  active,
  isSelf,
}: {
  id: string;
  active: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      const res = await setUserActiveAction(id, !active);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  function remove() {
    if (
      !window.confirm(
        "Excluir este usuário? Só funciona se ele não tiver registros vinculados (vendas, movimentos). Caso tenha, inative em vez de excluir.",
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteUserAction(id);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/usuarios/${id}`}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        title="Editar"
      >
        <Pencil className="h-4 w-4" />
      </Link>
      <button
        type="button"
        onClick={toggleActive}
        disabled={pending || isSelf}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30"
        title={isSelf ? "Você mesmo" : active ? "Inativar" : "Ativar"}
      >
        <Power className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending || isSelf}
        className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
        title={isSelf ? "Você mesmo" : "Excluir"}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
