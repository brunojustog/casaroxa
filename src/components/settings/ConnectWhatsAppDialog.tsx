"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, RefreshCw, X } from "lucide-react";

type Phase = "starting" | "waiting" | "connected" | "error" | "debug";

/**
 * Modal pra parear o WhatsApp da Casa Roxa via QR code.
 *
 * Fluxo:
 *   1. Ao abrir, chama POST /api/admin/whatsapp/connect → recebe QR.
 *   2. Renderiza QR (wuzapi pode mandar data:image/png;base64,... OU
 *      texto plain que precisa virar imagem com a lib qrcode).
 *   3. Polling a cada 2s em GET /api/admin/whatsapp/status pra detectar
 *      "Connected: true" / "loggedIn: true".
 *   4. Quando detecta conexão, mostra ✓ e chama onConnected() depois de 1s.
 */
export function ConnectWhatsAppDialog({
  open,
  onClose,
  onConnected,
}: {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [rawPayload, setRawPayload] = useState<unknown>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  /** Tenta extrair data URL ou texto do QR e renderiza um <img>. */
  async function renderQR(raw: unknown): Promise<boolean> {
    if (typeof raw !== "string" || raw.length === 0) {
      console.warn("[QR] payload inesperado:", raw);
      return false;
    }
    if (raw.startsWith("data:image")) {
      setQrDataUrl(raw);
      return true;
    }
    // Texto plain → gera PNG via lib qrcode
    try {
      const dataUrl = await QRCode.toDataURL(raw, {
        margin: 1,
        width: 320,
        errorCorrectionLevel: "M",
      });
      setQrDataUrl(dataUrl);
      return true;
    } catch (e) {
      console.error("[QR] erro ao renderizar:", e);
      return false;
    }
  }

  async function startConnect() {
    setPhase("starting");
    setError(null);
    setQrDataUrl(null);
    setRawPayload(null);
    try {
      const res = await fetch("/api/admin/whatsapp/connect", { method: "POST" });
      const data = await res.json();

      // Caso especial: número já está pareado — direto pra "connected"
      if (data.ok && data.alreadyConnected) {
        setPhase("connected");
        return;
      }

      if (!data.ok) {
        setError(data.error ?? "Falha ao iniciar conexão.");
        setRawPayload(data.raw ?? data);
        setPhase("error");
        return;
      }
      if (!data.qrcode) {
        setError(
          "Servidor respondeu, mas sem QR code reconhecível. Talvez já esteja conectado — feche e teste status. Se não, mostre o JSON abaixo pra debug.",
        );
        setRawPayload(data.raw ?? data);
        setPhase("debug");
        return;
      }
      const rendered = await renderQR(data.qrcode);
      if (!rendered) {
        setError("Não consegui renderizar o QR. Veja o JSON abaixo.");
        setRawPayload(data);
        setPhase("debug");
        return;
      }
      setPhase("waiting");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de rede.");
      setPhase("error");
    }
  }

  // Polling de status — só roda quando estamos esperando pareamento
  useEffect(() => {
    if (phase !== "waiting") return;

    let cancelled = false;
    function isConnected(d: unknown): boolean {
      if (!d || typeof d !== "object") return false;
      const obj = d as Record<string, unknown>;
      for (const [key, value] of Object.entries(obj)) {
        const norm = key.toLowerCase();
        if (
          value === true &&
          ["connected", "loggedin", "isconnected", "islogged", "paired"].includes(
            norm,
          )
        ) {
          return true;
        }
        if (
          typeof value === "string" &&
          /connected|paired|logged|online|ready|active/i.test(value)
        ) {
          return true;
        }
        if (
          ["data", "result", "session", "payload", "info"].includes(norm) &&
          value &&
          typeof value === "object"
        ) {
          if (isConnected(value)) return true;
        }
      }
      return false;
    }
    async function poll() {
      try {
        const res = await fetch("/api/admin/whatsapp/status");
        const data = await res.json();
        if (cancelled) return;
        if (data.ok && isConnected(data.data)) {
          setPhase("connected");
          return;
        }
      } catch {
        /* ignora — tenta de novo no próximo tick */
      }
      if (!cancelled) {
        pollRef.current = setTimeout(poll, 2_000);
      }
    }

    pollRef.current = setTimeout(poll, 2_000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [phase]);

  // Ao fechar/conectar: avisa pai
  useEffect(() => {
    if (phase === "connected") {
      const t = setTimeout(() => {
        onConnected();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [phase, onConnected]);

  // Quando o modal abre, dispara connect
  useEffect(() => {
    if (open) startConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="font-serif text-lg font-semibold text-slate-900">
            Conectar WhatsApp
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-6 text-center">
          {phase === "starting" && (
            <>
              <div className="mx-auto h-64 w-64 grid place-items-center text-slate-400">
                <RefreshCw className="h-10 w-10 animate-spin" />
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Iniciando conexão com a wuzapi…
              </p>
            </>
          )}

          {phase === "waiting" && qrDataUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR code pra parear o WhatsApp"
                className="mx-auto h-64 w-64 rounded-md border border-slate-200"
              />
              <p className="mt-4 text-sm text-slate-700">
                <strong>1.</strong> Abra o WhatsApp no celular do número da Casa Roxa.
              </p>
              <p className="mt-1 text-sm text-slate-700">
                <strong>2.</strong> Toque em <em>Aparelhos conectados → Conectar um aparelho</em>.
              </p>
              <p className="mt-1 text-sm text-slate-700">
                <strong>3.</strong> Aponte a câmera pra esse QR.
              </p>
              <p className="mt-3 text-xs text-slate-500 inline-flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Aguardando pareamento…
              </p>
              <button
                type="button"
                onClick={startConnect}
                className="mt-3 text-xs text-roxa-700 hover:underline"
              >
                QR expirou? Gerar novo
              </button>
            </>
          )}

          {phase === "connected" && (
            <>
              <div className="mx-auto h-64 w-64 grid place-items-center text-green-600">
                <CheckCircle2 className="h-24 w-24" strokeWidth={1.5} />
              </div>
              <p className="mt-3 text-base font-semibold text-green-700">
                Conectado!
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Casa Roxa pronta pra mandar mensagens.
              </p>
            </>
          )}

          {phase === "error" && (
            <>
              <div className="mx-auto h-64 w-64 grid place-items-center text-red-500">
                <X className="h-24 w-24" strokeWidth={1.5} />
              </div>
              <p className="mt-3 text-sm font-medium text-red-700">
                {error ?? "Erro ao conectar."}
              </p>
              {rawPayload !== null && (
                <details className="mt-3 text-left">
                  <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
                    Ver resposta do servidor (debug)
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-700 whitespace-pre-wrap">
                    {JSON.stringify(rawPayload, null, 2)}
                  </pre>
                </details>
              )}
              <button
                type="button"
                onClick={startConnect}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-roxa-300 bg-white px-3 py-1.5 text-xs font-medium text-roxa-700 hover:bg-roxa-50"
              >
                <RefreshCw className="h-3 w-3" />
                Tentar de novo
              </button>
            </>
          )}

          {phase === "debug" && (
            <>
              <div className="mx-auto h-32 w-32 grid place-items-center text-amber-500">
                <RefreshCw className="h-16 w-16" strokeWidth={1.5} />
              </div>
              <p className="mt-3 text-sm font-medium text-amber-800">
                {error}
              </p>
              <details className="mt-4 text-left" open>
                <summary className="cursor-pointer text-xs font-medium text-slate-700">
                  Resposta da wuzapi (mande pro suporte)
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-700 whitespace-pre-wrap">
                  {JSON.stringify(rawPayload, null, 2)}
                </pre>
              </details>
              <button
                type="button"
                onClick={startConnect}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-roxa-300 bg-white px-3 py-1.5 text-xs font-medium text-roxa-700 hover:bg-roxa-50"
              >
                <RefreshCw className="h-3 w-3" />
                Tentar de novo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
