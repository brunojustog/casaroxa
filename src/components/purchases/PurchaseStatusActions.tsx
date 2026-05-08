"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, Ban, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cancelPurchaseAction,
  confirmPurchaseAction,
  deletePurchaseAction,
} from "@/server/actions/purchases";
import type { PurchaseStatus } from "@prisma/client";

export function PurchaseStatusActions({
  id,
  status,
}: {
  id: string;
  status: PurchaseStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (
      !window.confirm(
        "Confirmar esta compra?\n\n" +
          "Isso vai:\n" +
          "1) Criar movimentos de ENTRADA no estoque para cada item\n" +
          "2) Atualizar o custo dos ingredientes marcados (e cascata para fichas/combos)\n\n" +
          "A compra ficará em status CONFIRMADA. Pode ser cancelada depois.",
      )
    )
      return;
    startTransition(async () => {
      const res = await confirmPurchaseAction(id);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  function cancel() {
    const isConfirmed = status === "CONFIRMADA";
    const msg = isConfirmed
      ? "Cancelar esta compra?\n\nEla está CONFIRMADA. Movimentos de PERDA serão criados para reverter o estoque (mas o histórico de custo não será revertido)."
      : "Cancelar este rascunho de compra?";
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      const res = await cancelPurchaseAction(id);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Excluir definitivamente este rascunho?")) return;
    startTransition(async () => {
      const res = await deletePurchaseAction(id);
      if (!res.ok) window.alert(res.error);
      else router.push("/compras");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "RASCUNHO" && (
        <>
          <Button onClick={confirm} disabled={pending}>
            <Check className="h-4 w-4" />
            Confirmar compra
          </Button>
          <Button variant="outline" onClick={cancel} disabled={pending}>
            <Ban className="h-4 w-4" />
            Cancelar
          </Button>
          <Button variant="danger" onClick={remove} disabled={pending}>
            <Trash2 className="h-4 w-4" />
            Excluir rascunho
          </Button>
        </>
      )}
      {status === "CONFIRMADA" && (
        <Button variant="outline" onClick={cancel} disabled={pending}>
          <Ban className="h-4 w-4" />
          Cancelar compra (estornar estoque)
        </Button>
      )}
    </div>
  );
}
