"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Lock, Sparkles, Trash2, Unlock, XCircle } from "lucide-react";
import { RaffleStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  deleteRaffleAction,
  setRaffleStatusAction,
} from "@/server/actions/raffles";
import { RaffleDrawDialog } from "./RaffleDrawDialog";

export function RaffleActions({
  raffleId,
  status,
  entryCount,
  totalNumbers,
  pendingPrizesCount,
  nextPrize,
}: {
  raffleId: string;
  status: RaffleStatus;
  entryCount: number;
  totalNumbers: number;
  /** Quantos prêmios ainda não foram sorteados */
  pendingPrizesCount: number;
  /** Próximo prêmio a ser sorteado (maior position pendente) */
  nextPrize: { position: number; description: string } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drawOpen, setDrawOpen] = useState(false);

  function changeStatus(next: RaffleStatus) {
    startTransition(async () => {
      const res = await setRaffleStatusAction(raffleId, next);
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  function draw() {
    if (entryCount === 0) {
      window.alert("Sem inscritos ainda — não dá pra sortear.");
      return;
    }
    if (!nextPrize) {
      window.alert("Não há mais prêmios pendentes pra sortear.");
      return;
    }
    if (
      !window.confirm(
        `Sortear ${nextPrize.position}º lugar (${nextPrize.description})?\n\n` +
          `Restam ${pendingPrizesCount} prêmio(s). O ganhador será notificado por WhatsApp.`,
      )
    )
      return;
    setDrawOpen(true);
  }

  function remove() {
    if (
      !window.confirm(
        "Excluir este sorteio? Só funciona se ainda não tiver inscritos.",
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteRaffleAction(raffleId);
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      router.push("/sorteios");
    });
  }

  // Botões mudam conforme status
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
          Abrir inscrições
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
          Encerrar inscrições
        </Button>
      )}

      {(status === "OPEN" || status === "CLOSED") && pendingPrizesCount > 0 && (
        <Button
          type="button"
          size="sm"
          onClick={draw}
          disabled={pending || entryCount === 0}
          className="bg-amber-500 hover:bg-amber-600 focus:ring-amber-500"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {pending
            ? "Sorteando…"
            : nextPrize
              ? `Sortear ${nextPrize.position}º lugar`
              : "Sortear próximo"}
        </Button>
      )}

      {status !== "DRAWN" && status !== "CANCELLED" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => changeStatus("CANCELLED")}
          disabled={pending}
          className="border-red-200 text-red-700 hover:bg-red-50"
        >
          <XCircle className="h-3.5 w-3.5" />
          Cancelar sorteio
        </Button>
      )}

      {status === "DRAFT" && entryCount === 0 && (
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="ml-auto inline-flex items-center gap-1 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          title="Excluir definitivamente"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {status === "DRAWN" && (
        <span className="text-xs text-slate-500">
          ✓ Sorteio finalizado. Ganhador notificado via WhatsApp.
        </span>
      )}

      <RaffleDrawDialog
        open={drawOpen}
        raffleId={raffleId}
        totalNumbers={totalNumbers}
        nextPrize={nextPrize}
        onClose={() => setDrawOpen(false)}
        onDone={() => router.refresh()}
      />
    </div>
  );
}
