"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendChatMessageAction } from "@/server/actions/chat";

export function ChatInput({
  conversationId,
}: {
  conversationId?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await sendChatMessageAction({
        conversationId: conversationId ?? null,
        message: trimmed,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setText("");
      // Se era nova conversa, redireciona
      if (!conversationId && res.data) {
        router.push(`/assistente/${res.data.conversationId}`);
        return;
      }
      router.refresh();
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white p-4">
      {error && (
        <div className="mb-2 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          placeholder="Pergunte sobre custos, estoque, compras... (Enter para enviar, Shift+Enter para quebrar linha)"
          rows={2}
          disabled={isPending}
          className="resize-none"
        />
        <Button type="button" onClick={send} disabled={isPending || !text.trim()}>
          <Send className="h-4 w-4" />
          {isPending ? "Pensando…" : "Enviar"}
        </Button>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">
        Versão inicial: o assistente lê dados mas ainda não modifica nada. Suporte a alterações
        com confirmação chega no próximo update.
      </p>
    </div>
  );
}
