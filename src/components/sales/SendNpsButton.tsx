"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Star } from "lucide-react";
import { sendNpsRequestAction } from "@/server/actions/nps";

export function SendNpsButton({
  saleId,
  alreadySent,
}: {
  saleId: string;
  alreadySent: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleClick() {
    const confirmMsg = alreadySent
      ? "Já foi enviada uma vez. Reenviar mesmo link agora?"
      : "Enviar pedido de avaliação ao cliente via WhatsApp?";
    if (!window.confirm(confirmMsg)) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await sendNpsRequestAction(saleId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(
        res.data?.whatsappStatus === "SENT"
          ? "Link de avaliação enviado pelo WhatsApp."
          : `Link gerado (status WhatsApp: ${res.data?.whatsappStatus ?? "?"}).`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-roxa-200 bg-white px-3 text-sm font-medium text-roxa-700 hover:bg-roxa-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Star className="h-3.5 w-3.5" />
        )}
        {alreadySent ? "Reenviar avaliação" : "Enviar avaliação"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && (
        <p className="text-xs text-green-700 inline-flex items-center gap-1">
          <Send className="h-3 w-3" /> {success}
        </p>
      )}
    </div>
  );
}
