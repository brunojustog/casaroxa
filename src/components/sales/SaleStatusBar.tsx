"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, X } from "lucide-react";
import { SaleStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  cancelSaleAction,
  concludeSaleAction,
  reopenSaleAction,
} from "@/server/actions/sales";

export function SaleStatusBar({
  saleId,
  status,
  itemCount,
}: {
  saleId: string;
  status: SaleStatus;
  itemCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onConclude() {
    if (itemCount === 0) {
      window.alert("Adicione ao menos 1 item antes de concluir.");
      return;
    }
    if (
      !window.confirm(
        "Concluir esta venda? Vai descontar os ingredientes do estoque automaticamente.",
      )
    )
      return;
    startTransition(async () => {
      const res = await concludeSaleAction(saleId);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  function onCancel() {
    const reason = window.prompt(
      status === SaleStatus.CONCLUIDA
        ? "Motivo do cancelamento (estoque será revertido):"
        : "Motivo do cancelamento (opcional):",
      "",
    );
    if (reason === null) return; // user clicou Cancel
    startTransition(async () => {
      const res = await cancelSaleAction(saleId, reason);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  function onReopen() {
    if (
      !window.confirm(
        "Reabrir esta venda pra edição? O desconto de estoque da conclusão será desfeito e refeito quando você concluir de novo.",
      )
    )
      return;
    startTransition(async () => {
      const res = await reopenSaleAction(saleId);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  if (status === SaleStatus.CANCELADA) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {status === SaleStatus.CONCLUIDA && (
        <Button
          type="button"
          variant="outline"
          onClick={onReopen}
          disabled={isPending}
        >
          <Pencil className="h-4 w-4" />
          {isPending ? "Reabrindo…" : "Editar (reabrir)"}
        </Button>
      )}
      {status === SaleStatus.ABERTA && (
        <Button
          type="button"
          variant="primary"
          onClick={onConclude}
          disabled={isPending}
        >
          <CheckCircle2 className="h-4 w-4" />
          {isPending ? "Concluindo…" : "Concluir venda"}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isPending}
        className="text-red-600 border-red-200 hover:bg-red-50"
      >
        <X className="h-4 w-4" />
        {status === SaleStatus.CONCLUIDA ? "Cancelar (reverter)" : "Cancelar"}
      </Button>
    </div>
  );
}
