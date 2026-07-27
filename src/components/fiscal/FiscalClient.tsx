"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Power, Printer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import {
  cancelNfceAction,
  toggleFiscalAction,
  updateFiscalConfigAction,
} from "@/server/actions/fiscal";

type Config = {
  fiscalEnabled: boolean;
  fiscalEnvironment: string;
  fiscalSeries: number;
  fiscalNextNumber: number;
  fiscalDefaultCfop: string;
  fiscalDefaultNcm: string;
  fiscalCscId: string | null;
  certInstalled: boolean;
  cscConfigured: boolean;
};

type DocRow = {
  id: string;
  saleNumber: number;
  customerName: string | null;
  number: number;
  series: number;
  status: string;
  environment: string;
  accessKey: string | null;
  cpfCnpj: string | null;
  totalAmount: number;
  errorMessage: string | null;
  createdAt: string;
};

const STATUS_TONE: Record<string, "success" | "info" | "neutral" | "danger" | "warning"> = {
  AUTORIZADA: "success",
  PENDENTE: "info",
  REJEITADA: "danger",
  ERRO: "danger",
  CANCELADA: "neutral",
};

export function FiscalClient({ config, docs }: { config: Config; docs: DocRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [env, setEnv] = useState(config.fiscalEnvironment);
  const [series, setSeries] = useState(String(config.fiscalSeries));
  const [nextNumber, setNextNumber] = useState(String(config.fiscalNextNumber));
  const [cfop, setCfop] = useState(config.fiscalDefaultCfop);
  const [ncm, setNcm] = useState(config.fiscalDefaultNcm);
  const [cscId, setCscId] = useState(config.fiscalCscId ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  function toggle() {
    startTransition(async () => {
      const res = await toggleFiscalAction(!config.fiscalEnabled);
      if (!res.ok) window.alert(res.error);
      router.refresh();
    });
  }

  function saveConfig() {
    setMsg(null);
    startTransition(async () => {
      const res = await updateFiscalConfigAction({
        environment: env,
        series: Number(series) || 1,
        nextNumber: Number(nextNumber) || 1,
        defaultCfop: cfop,
        defaultNcm: ncm,
        cscId: cscId || null,
      });
      setMsg(res.ok ? "✓ Configurações salvas" : res.error);
      router.refresh();
    });
  }

  function cancelar(docId: string) {
    const reason = window.prompt(
      "Justificativa do cancelamento (mínimo 15 caracteres):",
      "Erro de digitação na venda, cancelada para correção",
    );
    if (!reason) return;
    startTransition(async () => {
      const res = await cancelNfceAction(docId, reason);
      if (!res.ok) window.alert(res.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Chave geral */}
      <div
        className={`flex flex-wrap items-center gap-3 rounded-xl border-2 p-4 ${
          config.fiscalEnabled ? "border-green-300 bg-green-50" : "border-slate-200 bg-slate-50"
        }`}
      >
        <FileText
          className={`h-8 w-8 ${config.fiscalEnabled ? "text-green-700" : "text-slate-400"}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            Emissão fiscal:{" "}
            <span className={config.fiscalEnabled ? "text-green-700" : "text-slate-500"}>
              {config.fiscalEnabled ? "LIGADA" : "DESLIGADA"}
            </span>{" "}
            <span className="ml-1 text-xs font-normal text-slate-500">
              (ambiente {config.fiscalEnvironment.toLowerCase()})
            </span>
          </p>
          <p className="text-xs text-slate-600">
            Ligada, o PDV mostra o botão “Emitir NFC-e” com CPF na nota opcional após concluir a
            venda.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={isPending}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${
            config.fiscalEnabled ? "bg-slate-500 hover:bg-slate-600" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          <Power className="h-4 w-4" />
          {config.fiscalEnabled ? "Desligar" : "Ligar"}
        </button>
      </div>

      {/* Status dos pré-requisitos */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ReadyCard ok={config.certInstalled} label="Certificado A1" hintOk="instalado no servidor" hintNo="aguardando o e-CNPJ A1 (env FISCAL_CERT_PATH/PASS)" />
        <ReadyCard ok={config.cscConfigured} label="CSC (SEFAZ-SP)" hintOk="configurado" hintNo="aguardando credenciamento + token (env FISCAL_CSC + ID abaixo)" />
        <ReadyCard
          ok={config.fiscalEnvironment === "PRODUCAO"}
          label="Ambiente"
          hintOk="produção — notas valem!"
          hintNo={config.fiscalEnvironment === "SIMULADO" ? "simulado — sem valor fiscal" : "homologação — testes SEFAZ"}
          neutral={config.fiscalEnvironment !== "PRODUCAO"}
        />
      </div>

      {/* Configurações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurações de emissão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            <Field label="Ambiente">
              <Select value={env} onChange={(e) => setEnv(e.currentTarget.value)}>
                <option value="SIMULADO">Simulado</option>
                <option value="HOMOLOGACAO">Homologação</option>
                <option value="PRODUCAO">Produção</option>
              </Select>
            </Field>
            <Field label="Série">
              <Input type="number" min="1" value={series} onChange={(e) => setSeries(e.currentTarget.value)} />
            </Field>
            <Field label="Próximo nº">
              <Input type="number" min="1" value={nextNumber} onChange={(e) => setNextNumber(e.currentTarget.value)} />
            </Field>
            <Field label="CFOP padrão">
              <Input maxLength={4} value={cfop} onChange={(e) => setCfop(e.currentTarget.value)} />
            </Field>
            <Field label="NCM padrão">
              <Input maxLength={8} value={ncm} onChange={(e) => setNcm(e.currentTarget.value)} />
            </Field>
            <Field label="ID do CSC" hint="o token fica no servidor">
              <Input value={cscId} onChange={(e) => setCscId(e.currentTarget.value)} placeholder="000001" />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveConfig} disabled={isPending}>Salvar configurações</Button>
            {msg && (
              <span className={`text-sm ${msg.startsWith("✓") ? "text-green-700" : "text-red-700"}`}>{msg}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notas emitidas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notas emitidas</CardTitle>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-500">
              Nenhuma NFC-e emitida ainda. Ligue a chave e emita pelo PDV.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {docs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <Badge tone={STATUS_TONE[d.status] ?? "neutral"}>{d.status}</Badge>
                  <span className="text-sm font-medium text-slate-900">
                    NFC-e {d.number}/{d.series}
                  </span>
                  <span className="text-xs text-slate-500">venda #{d.saleNumber}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(d.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {d.cpfCnpj && <span className="text-xs text-slate-500">CPF {d.cpfCnpj}</span>}
                  {d.environment !== "PRODUCAO" && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      {d.environment}
                    </span>
                  )}
                  <span className="ml-auto text-sm font-semibold tabular-nums">
                    {formatBRL(d.totalAmount)}
                  </span>
                  {d.status === "AUTORIZADA" && (
                    <>
                      <button
                        type="button"
                        title="Imprimir DANFE"
                        onClick={() => window.open(`/pdv-danfe/${d.id}`, "_blank", "width=320,height=640")}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-roxa-50 hover:text-roxa-700"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Cancelar NFC-e"
                        onClick={() => cancelar(d.id)}
                        disabled={isPending}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {d.errorMessage && (
                    <p className="w-full text-xs text-red-600">{d.errorMessage}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReadyCard({
  ok,
  label,
  hintOk,
  hintNo,
  neutral = false,
}: {
  ok: boolean;
  label: string;
  hintOk: string;
  hintNo: string;
  neutral?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        ok ? "border-green-200 bg-green-50" : neutral ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-sm font-semibold text-slate-800">
        {ok ? "✅" : neutral ? "🟡" : "⬜"} {label}
      </p>
      <p className="text-xs text-slate-600">{ok ? hintOk : hintNo}</p>
    </div>
  );
}
