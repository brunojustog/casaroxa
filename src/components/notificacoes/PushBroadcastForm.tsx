"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { sendPushBroadcastAction } from "@/server/actions/push-broadcast";

export function PushBroadcastForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (
      !window.confirm(
        "Enviar esta notificação AGORA pra todos os aparelhos com o app? Não dá pra desfazer.",
      )
    ) {
      return;
    }
    setSending(true);
    setFeedback(null);
    const result = await sendPushBroadcastAction({
      title,
      body,
      url: url || undefined,
    });
    setSending(false);
    if (result.ok) {
      const sent = result.data?.sent ?? 0;
      setFeedback({ ok: true, msg: `Enviado pra ${sent} aparelho${sent === 1 ? "" : "s"}.` });
      setTitle("");
      setBody("");
      setUrl("");
      router.refresh();
    } else {
      setFeedback({ ok: false, msg: result.error ?? "Erro ao enviar." });
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="mb-1 font-serif text-lg font-semibold text-roxa-900">
          Novo aviso
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Aparece como notificação no celular do cliente. Seja curto e direto —
          ex.: &quot;🔥 Frango saindo do forno agora!&quot;
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              placeholder="🔥 Frango saindo do forno!"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Mensagem <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              maxLength={300}
              value={body}
              onChange={(e) => setBody(e.currentTarget.value)}
              placeholder="Fornada fresquinha te esperando. Garanta o seu antes que acabe!"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Link ao tocar (opcional)
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.currentTarget.value)}
              placeholder="/cardapio"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
            />
            <p className="text-[11px] text-slate-500">
              Ex.: /cardapio, /encomenda, /sorteio. Vazio = abre a Home.
            </p>
          </div>

          {feedback && (
            <p
              className={
                feedback.ok
                  ? "rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800"
                  : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              }
            >
              {feedback.msg}
            </p>
          )}

          <button
            type="submit"
            disabled={disabled || sending}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-roxa-700 px-5 text-sm font-semibold text-white hover:bg-roxa-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {sending ? "Enviando…" : "Enviar pra todos"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
