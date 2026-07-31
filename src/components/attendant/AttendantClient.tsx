"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Hand, MessageCircle, Power, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  setAttendantTestPhonesAction,
  setConversationHandoffAction,
  toggleAttendantAction,
} from "@/server/actions/attendant";

type Msg = { id: string; role: string; content: string; createdAt: string };
type Conv = {
  id: string;
  phone: string;
  displayName: string | null;
  customerName: string | null;
  handedOff: boolean;
  lastMessageAt: string;
  messages: Msg[];
};

export function AttendantClient({
  enabled,
  testPhones,
  webhookConfigured,
  usageCount30d,
  usageCostUsd30d,
  conversations,
}: {
  enabled: boolean;
  testPhones: string;
  webhookConfigured: boolean;
  usageCount30d: number;
  usageCostUsd30d: number;
  conversations: Conv[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phones, setPhones] = useState(testPhones);
  const [msg, setMsg] = useState<string | null>(null);

  function toggle() {
    startTransition(async () => {
      const res = await toggleAttendantAction(!enabled);
      if (!res.ok) window.alert(res.error);
      router.refresh();
    });
  }

  function savePhones() {
    setMsg(null);
    startTransition(async () => {
      const res = await setAttendantTestPhonesAction(phones);
      setMsg(res.ok ? "✓ Salvo" : res.error);
      router.refresh();
    });
  }

  function setHandoff(id: string, handedOff: boolean) {
    startTransition(async () => {
      const res = await setConversationHandoffAction(id, handedOff);
      if (!res.ok) window.alert(res.error);
      router.refresh();
    });
  }

  const testMode = testPhones.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* Chave geral */}
      <div
        className={`flex flex-wrap items-center gap-3 rounded-xl border-2 p-4 ${
          enabled ? "border-green-300 bg-green-50" : "border-slate-200 bg-slate-50"
        }`}
      >
        <Bot className={`h-9 w-9 ${enabled ? "text-green-700" : "text-slate-400"}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            Atendente IA:{" "}
            <span className={enabled ? "text-green-700" : "text-slate-500"}>
              {enabled ? "LIGADA" : "DESLIGADA"}
            </span>
            {enabled && testMode && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                MODO TESTE
              </span>
            )}
          </p>
          <p className="text-xs text-slate-600">
            {enabled
              ? testMode
                ? "Respondendo SÓ aos telefones do modo teste abaixo."
                : "Respondendo a todos os clientes no WhatsApp da loja."
              : "Mensagens recebidas são registradas, mas ninguém recebe resposta automática."}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={isPending}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${
            enabled ? "bg-slate-500 hover:bg-slate-600" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          <Power className="h-4 w-4" />
          {enabled ? "Desligar" : "Ligar"}
        </button>
      </div>

      {!webhookConfigured && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠️ Falta configurar o <strong>webhook da wuzapi</strong> no servidor (env
          WA_WEBHOOK_TOKEN + apontar o webhook da instância). Sem isso as mensagens não chegam
          aqui.
        </div>
      )}

      {/* Modo teste + custo */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Modo teste</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-slate-600">
              Telefones (com DDD) separados por vírgula. Enquanto houver números aqui, a IA
              responde <strong>só a eles</strong> — perfeito pra você e a Thais treinarem antes de
              liberar. Deixe vazio pra responder a todos.
            </p>
            <div className="flex gap-2">
              <Input
                value={phones}
                onChange={(e) => setPhones(e.currentTarget.value)}
                placeholder="5514999998888, 5514988887777"
                className="flex-1"
              />
              <Button onClick={savePhones} disabled={isPending}>
                Salvar
              </Button>
            </div>
            {msg && (
              <p className={`text-xs ${msg.startsWith("✓") ? "text-green-700" : "text-red-700"}`}>
                {msg}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Custo (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-slate-900">
              US$ {usageCostUsd30d.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500">{usageCount30d} respostas geradas</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Conversas recentes</span>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex items-center gap-1 text-xs font-normal text-roxa-700 hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> atualizar
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {conversations.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              Nenhuma conversa ainda. Assim que alguém mandar mensagem no WhatsApp da loja, ela
              aparece aqui.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {conversations.map((c) => (
                <li key={c.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-900">
                      {c.customerName ?? c.displayName ?? `+${c.phone}`}
                    </span>
                    <span className="text-xs text-slate-400">+{c.phone}</span>
                    {c.handedOff ? (
                      <Badge tone="warning">com humano</Badge>
                    ) : (
                      <Badge tone="success">com a IA</Badge>
                    )}
                    <span className="ml-auto text-xs text-slate-400">
                      {new Date(c.lastMessageAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHandoff(c.id, !c.handedOff)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-roxa-300 hover:text-roxa-700"
                      title={c.handedOff ? "Devolver pra IA" : "Assumir conversa (IA silencia)"}
                    >
                      {c.handedOff ? (
                        <>
                          <Bot className="h-3 w-3" /> Devolver pra IA
                        </>
                      ) : (
                        <>
                          <Hand className="h-3 w-3" /> Assumir
                        </>
                      )}
                    </button>
                  </div>
                  <div className="mt-2 space-y-1 pl-6">
                    {c.messages.map((m) => (
                      <p
                        key={m.id}
                        className={`text-xs ${
                          m.role === "USER"
                            ? "text-slate-800"
                            : m.role === "ASSISTANT"
                              ? "text-roxa-700"
                              : "italic text-amber-700"
                        }`}
                      >
                        <span className="font-semibold">
                          {m.role === "USER" ? "Cliente" : m.role === "ASSISTANT" ? "IA" : "•"}:
                        </span>{" "}
                        {m.content.length > 220 ? `${m.content.slice(0, 220)}…` : m.content}
                      </p>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
