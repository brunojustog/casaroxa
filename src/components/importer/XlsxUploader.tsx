"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { importXlsxAction } from "@/server/actions/import";
import type { ImportMode, ImportResult, SheetSummary } from "@/schemas/import.schema";

export function XlsxUploader() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>("upsert");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.currentTarget.files?.[0] ?? null;
    setFile(f);
    setPreview(null);
    setErrorMsg(null);
    setOkMsg(null);
  }

  function runDryRun() {
    if (!file) {
      setErrorMsg("Selecione um arquivo XLSX primeiro.");
      return;
    }
    setErrorMsg(null);
    setOkMsg(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("mode", mode);
    fd.set("dryRun", "true");

    startTransition(async () => {
      const res = await importXlsxAction(fd);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      setPreview(res.data ?? null);
    });
  }

  function execute() {
    if (!file || !preview) return;
    if (
      !window.confirm(
        "Confirmar importação? Esta operação é irreversível e roda em uma única transação.",
      )
    )
      return;

    setErrorMsg(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("mode", mode);
    fd.set("dryRun", "false");

    startTransition(async () => {
      const res = await importXlsxAction(fd);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      setPreview(res.data ?? null);
      setOkMsg("Importação concluída com sucesso.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Selecione o arquivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={onFileChange}
            className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-roxa-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-roxa-800 file:cursor-pointer"
          />
          {file && (
            <div className="flex items-center gap-2 text-sm text-slate-600 rounded-md bg-slate-50 px-3 py-2 border border-slate-200">
              <FileSpreadsheet className="h-4 w-4 text-slate-500" />
              <span className="font-medium">{file.name}</span>
              <span className="text-xs text-slate-400">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Modo de importação">
              <Select
                value={mode}
                onChange={(e) => setMode(e.currentTarget.value as ImportMode)}
              >
                <option value="upsert">Upsert (criar novos + atualizar existentes)</option>
                <option value="create_only">Criar somente (ignorar existentes)</option>
                <option value="update_only">Atualizar somente (ignorar novos)</option>
              </Select>
            </Field>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={runDryRun}
                disabled={!file || isPending}
                variant="outline"
              >
                <Upload className="h-4 w-4" />
                {isPending && !preview ? "Analisando…" : "Analisar arquivo"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {okMsg && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          {okMsg}
        </div>
      )}

      {preview && <PreviewBlock preview={preview} />}

      {preview && !preview.executed && (
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button type="button" onClick={execute} disabled={isPending}>
            {isPending ? "Importando…" : `Importar (${describeMode(mode)})`}
          </Button>
        </div>
      )}
    </div>
  );
}

function PreviewBlock({ preview }: { preview: ImportResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {preview.executed ? "Resultado da importação" : "2. Prévia"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-slate-500">
          Abas detectadas no arquivo: {preview.detectedSheets.join(", ") || "—"}
        </p>

        {preview.warnings.length > 0 && (
          <ul className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 space-y-1">
            {preview.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        )}

        {preview.summaries.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma aba reconhecida.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Aba</th>
                <th className="px-3 py-2 text-right">Linhas</th>
                <th className="px-3 py-2 text-right">Criar</th>
                <th className="px-3 py-2 text-right">Atualizar</th>
                <th className="px-3 py-2 text-right">Pular</th>
                <th className="px-3 py-2 text-right">Erros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview.summaries.map((s) => (
                <SummaryRow key={s.sheet} s={s} />
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryRow({ s }: { s: SheetSummary }) {
  return (
    <>
      <tr>
        <td className="px-3 py-2 font-medium text-slate-900">{s.sheet}</td>
        <td className="px-3 py-2 text-right tabular-nums">{s.detected}</td>
        <td className="px-3 py-2 text-right tabular-nums text-green-700">{s.willCreate}</td>
        <td className="px-3 py-2 text-right tabular-nums text-blue-700">{s.willUpdate}</td>
        <td className="px-3 py-2 text-right tabular-nums text-slate-500">{s.willSkip}</td>
        <td className="px-3 py-2 text-right tabular-nums text-red-700">{s.errors.length}</td>
      </tr>
      {s.errors.length > 0 && (
        <tr>
          <td colSpan={6} className="px-3 pb-2">
            <details className="text-xs text-slate-600">
              <summary className="cursor-pointer text-red-600">
                Mostrar erros ({s.errors.length})
              </summary>
              <ul className="mt-1 ml-4 list-disc space-y-0.5">
                {s.errors.slice(0, 20).map((e, i) => (
                  <li key={i}>
                    Linha {e.row}: {e.message}
                  </li>
                ))}
                {s.errors.length > 20 && (
                  <li className="text-slate-400">… e mais {s.errors.length - 20}</li>
                )}
              </ul>
            </details>
          </td>
        </tr>
      )}
    </>
  );
}

function describeMode(m: ImportMode): string {
  switch (m) {
    case "upsert":
      return "criar e atualizar";
    case "create_only":
      return "criar somente";
    case "update_only":
      return "atualizar somente";
  }
}
