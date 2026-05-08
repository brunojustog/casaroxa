"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { Copy, Pencil, Trash2 } from "lucide-react";
import {
  deleteScenarioAction,
  duplicateScenarioAction,
} from "@/server/actions/scenarios";

export function ScenarioRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function duplicate() {
    startTransition(async () => {
      const res = await duplicateScenarioAction(id);
      if (!res.ok) window.alert(res.error);
    });
  }

  function remove() {
    if (!window.confirm("Excluir este cenário?")) return;
    startTransition(async () => {
      const res = await deleteScenarioAction(id);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/cenarios/${id}`}
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
