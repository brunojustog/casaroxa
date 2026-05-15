"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { AiActionKind, AiActionStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  approveAiActionAction,
  rejectAiActionAction,
} from "@/server/actions/ai-actions";

const KIND_LABEL: Record<AiActionKind, string> = {
  CREATE_COUPON: "Criar cupom",
  UPDATE_PRODUCT_PRICE: "Ajustar preço",
  SEND_WHATSAPP_CUSTOMER: "Enviar WhatsApp",
  DISPATCH_CAMPAIGN: "Disparar campanha",
};

const STATUS_TONE: Record<
  AiActionStatus,
  "neutral" | "info" | "warning" | "danger" | "success"
> = {
  PENDING: "warning",
  APPROVED: "info",
  EXECUTED: "success",
  FAILED: "danger",
  REJECTED: "neutral",
  EXPIRED: "neutral",
};

const STATUS_LABEL: Record<AiActionStatus, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  EXECUTED: "Executada",
  FAILED: "Falhou",
  REJECTED: "Rejeitada",
  EXPIRED: "Expirada",
};

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export function AiActionRow({
  action,
}: {
  action: {
    id: string;
    kind: AiActionKind;
    status: AiActionStatus;
    summary: string;
    reasoning: string | null;
    payload: unknown;
    failureMessage: string | null;
    proposedAt: Date;
    expiresAt: Date;
    decidedAt: Date | null;
    decidedBy: { name: string } | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  function approve() {
    if (
      !window.confirm(
        `Aprovar e EXECUTAR esta ação?\n\n${action.summary}\n\nEsta operação não tem desfazer simples.`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await approveAiActionAction(action.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function reject() {
    if (!window.confirm("Rejeitar esta sugestão da IA?")) return;
    setError(null);
    startTransition(async () => {
      const res = await rejectAiActionAction(action.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const isPending = action.status === "PENDING";
  const minutesUntilExpiry = Math.max(
    0,
    Math.floor((action.expiresAt.getTime() - Date.now()) / 60000),
  );

  return (
    <li className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-roxa-100 text-roxa-700">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={STATUS_TONE[action.status]}>
              {STATUS_LABEL[action.status]}
            </Badge>
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {KIND_LABEL[action.kind]}
            </span>
            <span className="text-[11px] text-slate-400">
              {fmtDateTime(action.proposedAt)}
            </span>
            {isPending && (
              <span className="text-[11px] font-medium text-amber-700">
                Expira em {minutesUntilExpiry < 60
                  ? `${minutesUntilExpiry}min`
                  : `${Math.floor(minutesUntilExpiry / 60)}h`}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-900">{action.summary}</p>
          {action.reasoning && (
            <p className="text-xs text-slate-600 italic">
              &ldquo;{action.reasoning}&rdquo;
            </p>
          )}
          {action.failureMessage && (
            <p className="text-xs text-red-700">
              ❌ {action.failureMessage}
            </p>
          )}
          {action.decidedBy && action.decidedAt && (
            <p className="text-[11px] text-slate-500">
              {action.status === "REJECTED" ? "Rejeitada" : "Decidida"} por{" "}
              {action.decidedBy.name} em {fmtDateTime(action.decidedAt)}
            </p>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-roxa-700"
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {expanded ? "Esconder payload" : "Ver payload"}
          </button>
          {expanded && (
            <pre className="mt-1 max-h-48 overflow-auto rounded-md border border-slate-100 bg-slate-50 p-2 text-[11px] font-mono text-slate-700">
              {JSON.stringify(action.payload, null, 2)}
            </pre>
          )}
        </div>
        {isPending && (
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              type="button"
              onClick={approve}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Aprovar
            </button>
            <button
              type="button"
              onClick={reject}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              <X className="h-3 w-3" />
              Rejeitar
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </li>
  );
}
