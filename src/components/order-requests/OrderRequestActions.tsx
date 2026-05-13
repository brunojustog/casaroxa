"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Check,
  ChefHat,
  CircleCheck,
  PackageCheck,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { OrderRequestStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  approveOrderRequestAction,
  markDepositPaidAction,
  rejectOrderRequestAction,
  setOrderRequestStatusAction,
} from "@/server/actions/order-requests";

export function OrderRequestActions({
  id,
  status,
  hasDeposit,
  depositPaid,
}: {
  id: string;
  status: OrderRequestStatus;
  hasDeposit: boolean;
  depositPaid: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function approve() {
    const wantDeposit = window.confirm(
      "Pedir sinal antecipado pra esta encomenda? OK = sim, Cancelar = aprovar sem sinal.",
    );
    let depositCents: number | null = null;
    let adminNotes: string | null = null;
    if (wantDeposit) {
      const raw = window.prompt("Valor do sinal em R$ (ex: 50.00):");
      if (raw === null) return;
      const num = parseFloat(raw.replace(",", "."));
      if (!Number.isFinite(num) || num <= 0) {
        window.alert("Valor inválido.");
        return;
      }
      depositCents = Math.round(num * 100);
    }
    const notes = window.prompt(
      "Observações internas (opcional, só admin vê):",
    );
    if (notes && notes.trim()) adminNotes = notes.trim();

    startTransition(async () => {
      const res = await approveOrderRequestAction(id, {
        depositRequiredCents: depositCents,
        adminNotes,
      });
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  function reject() {
    const reason = window.prompt("Motivo da recusa (visível ao cliente):");
    if (!reason || !reason.trim()) return;
    startTransition(async () => {
      const res = await rejectOrderRequestAction(id, {
        rejectionReason: reason.trim(),
      });
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  function advance(next: OrderRequestStatus, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    startTransition(async () => {
      const res = await setOrderRequestStatusAction(id, next);
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  function payDeposit() {
    if (!window.confirm("Confirmar recebimento do sinal?")) return;
    startTransition(async () => {
      const res = await markDepositPaidAction(id);
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <span className="text-xs uppercase tracking-wider text-slate-500 mr-1">
        Ações
      </span>

      {status === "PENDENTE" && (
        <>
          <Button type="button" size="sm" onClick={approve} disabled={pending}>
            <Check className="h-3.5 w-3.5" />
            Aprovar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={reject}
            disabled={pending}
            className="border-red-200 text-red-700 hover:bg-red-50"
          >
            <X className="h-3.5 w-3.5" />
            Recusar
          </Button>
        </>
      )}

      {status === "APROVADA" && (
        <Button
          type="button"
          size="sm"
          onClick={() => advance("EM_PRODUCAO")}
          disabled={pending}
        >
          <ChefHat className="h-3.5 w-3.5" />
          Iniciar produção
        </Button>
      )}

      {status === "EM_PRODUCAO" && (
        <Button
          type="button"
          size="sm"
          onClick={() => advance("PRONTA")}
          disabled={pending}
        >
          <PackageCheck className="h-3.5 w-3.5" />
          Marcar como pronta
        </Button>
      )}

      {status === "PRONTA" && (
        <Button
          type="button"
          size="sm"
          onClick={() =>
            advance(
              "ENTREGUE",
              "Confirmar entrega? Isso fecha a Sale como CONCLUIDA.",
            )
          }
          disabled={pending}
        >
          <CircleCheck className="h-3.5 w-3.5" />
          Marcar como entregue
        </Button>
      )}

      {hasDeposit && !depositPaid && status !== "CANCELADA" && status !== "RECUSADA" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={payDeposit}
          disabled={pending}
        >
          <Wallet className="h-3.5 w-3.5" />
          Confirmar sinal recebido
        </Button>
      )}

      {["APROVADA", "EM_PRODUCAO", "PRONTA"].includes(status) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            advance(
              "CANCELADA",
              "Cancelar encomenda? A Sale vinculada também será cancelada.",
            )
          }
          disabled={pending}
          className="ml-auto border-red-200 text-red-700 hover:bg-red-50"
        >
          <XCircle className="h-3.5 w-3.5" />
          Cancelar
        </Button>
      )}
    </div>
  );
}
