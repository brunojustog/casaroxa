"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/**
 * Botão de compartilhar com Web Share API (mobile nativo) e fallback
 * pra "copiar link" (desktop). O preview que aparece no destino é
 * controlado pelas meta tags Open Graph da página atual.
 */
export function ShareButton({
  title,
  text,
  className,
  iconOnly = false,
}: {
  title: string;
  text?: string;
  /** Sobrescreve o estilo do container. Default: pílula compacta. */
  className?: string;
  /** Esconde o texto "Compartilhar" e mostra só o ícone. */
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);

  async function share() {
    if (pending) return;
    setPending(true);
    const url = typeof window !== "undefined" ? window.location.href : "";
    const data: ShareData = { title, text, url };
    try {
      // Web Share API (mobile / Chrome desktop com sistema operacional suportando)
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        (typeof navigator.canShare !== "function" || navigator.canShare(data))
      ) {
        await navigator.share(data);
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // último fallback: prompt manual
        // eslint-disable-next-line no-alert
        window.prompt("Copie o link:", url);
      }
    } catch {
      // usuário cancelou ou erro — silencioso
    } finally {
      setPending(false);
    }
  }

  const baseClasses =
    className ??
    "inline-flex items-center gap-1.5 rounded-full border border-roxa-200 bg-white px-3 py-1.5 text-xs font-medium text-roxa-800 hover:bg-roxa-50";

  return (
    <button
      type="button"
      onClick={share}
      disabled={pending}
      className={baseClasses}
      aria-label="Compartilhar"
      title={copied ? "Link copiado!" : "Compartilhar"}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Share2 className="h-3.5 w-3.5" />
      )}
      {!iconOnly && (
        <span>
          {copied ? "Copiado" : "Compartilhar"}
        </span>
      )}
    </button>
  );
}
