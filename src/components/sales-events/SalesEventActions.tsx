"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Lock, Trash2, Unlock, XCircle } from "lucide-react";
import { SalesEventStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  deleteSalesEventAction,
  setSalesEventStatusAction,
} from "@/server/actions/sales-events";

export function SalesEventActions({
  eventId,
  status,
  salesCount,
}: {
  eventId: string;
  status: SalesEventStatus;
  salesCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeStatus(next: SalesEventStatus) {
    startTransition(async () => {
      const res = await setSalesEventStatusAction(eventId, next);
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    if (
      !window.confirm("Excluir esta pré-venda? Só funciona sem pedidos vinculados.")
    )
      return;
    startTransition(async () => {
      const res = await deleteSalesEventAction(eventId);
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      router.push("/pre-vendas");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <span className="text-xs uppercase tracking-wider text-slate-500 mr-1">
        Ações
      </span>

      {status === "DRAFT" && (
        <Button
          type="button"
          size="sm"
          onClick={() => changeStatus("OPEN")}
          disabled={pending}
        >
          <Unlock className="h-3.5 w-3.5" />
          Abrir pra clientes
        </Button>
      )}

      {status === "OPEN" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => changeStatus("CLOSED")}
          disabled={pending}
        >
          <Lock className="h-3.5 w-3.5" />
          Fechar (parar de aceitar)
        </Button>
      )}

      {status === "CLOSED" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => changeStatus("OPEN")}
          disabled={pending}
        >
          <Unlock className="h-3.5 w-3.5" />
          Reabrir
        </Button>
      )}

      {status !== "CANCELLED" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => changeStatus("CANCELLED")}
          disabled={pending}
          className="border-red-200 text-red-700 hover:bg-red-50"
        >
          <XCircle className="h-3.5 w-3.5" />
          Cancelar
        </Button>
      )}

      {status === "DRAFT" && salesCount === 0 && (
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="ml-auto inline-flex items-center gap-1 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          title="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
