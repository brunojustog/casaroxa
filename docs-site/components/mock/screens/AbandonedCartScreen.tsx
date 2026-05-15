"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, MessageCircle, CheckCircle2 } from "lucide-react";
import { BrowserFrame } from "../BrowserFrame";
import { PublicSiteShell } from "../PublicSiteShell";

type Phase = "checkout" | "left" | "whatsapp" | "recovered";

export function AbandonedCartScreen() {
  const [phase, setPhase] = useState<Phase>("checkout");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (phase === "checkout") {
      const target = "(14) 99999-1234";
      let i = 0;
      const typing = setInterval(() => {
        i++;
        setPhone(target.slice(0, i));
        if (i >= target.length) {
          clearInterval(typing);
          setTimeout(() => setPhase("left"), 1200);
        }
      }, 70);
      return () => clearInterval(typing);
    }
    if (phase === "left") {
      const t = setTimeout(() => setPhase("whatsapp"), 1800);
      return () => clearTimeout(t);
    }
    if (phase === "whatsapp") {
      const t = setTimeout(() => setPhase("recovered"), 2500);
      return () => clearTimeout(t);
    }
    if (phase === "recovered") {
      const t = setTimeout(() => {
        setPhase("checkout");
        setPhone("");
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [phase]);

  return (
    <BrowserFrame
      url="casaroxa.com.br/checkout"
      caption="Cliente digita telefone, sai sem finalizar → 30min depois recebe WhatsApp de recuperação → volta e finaliza."
    >
      <PublicSiteShell active="Cardápio">
        <div className="space-y-3">
          <h2 className="font-serif text-base font-bold text-roxa-900">Checkout</h2>

          <div className="rounded-md border border-roxa-100 bg-white p-2 space-y-1">
            <p className="text-[10px] font-semibold text-slate-700">Seu pedido</p>
            <p className="text-[10px] text-slate-600">1× Combo Costela Casal — R$ 199,90</p>
          </div>

          <div className="rounded-md border border-roxa-100 bg-white p-2 space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-700">
              Telefone (com DDD) *
            </label>
            <div className="h-7 rounded border border-slate-300 bg-white px-2 flex items-center text-[11px] font-mono">
              {phone}
              <span className="ml-0.5 h-3 w-px bg-slate-400 animate-pulse" />
            </div>
            <p className="text-[8px] text-blue-700 italic">
              📡 Sistema captura silenciosamente após 3s (debounce)
            </p>
          </div>

          {(phase === "left" || phase === "whatsapp" || phase === "recovered") && (
            <div className="rounded-md border-2 border-amber-300 bg-amber-50 p-2 animate-fade-in">
              <p className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900">
                <ShoppingCart className="h-3 w-3" />
                Cliente saiu da página · cart capturado
              </p>
              <p className="text-[9px] text-amber-800 mt-0.5">
                AbandonedCart criado com phone {phone || "..."}
              </p>
            </div>
          )}

          {(phase === "whatsapp" || phase === "recovered") && (
            <div className="rounded-md border-2 border-green-300 bg-green-50 p-2 animate-fade-in space-y-1">
              <p className="inline-flex items-center gap-1 text-[10px] font-bold text-green-900">
                <MessageCircle className="h-3 w-3" />
                30 min depois — cron disparou WhatsApp
              </p>
              <div className="rounded bg-white border border-green-200 p-1.5 text-[9px] text-slate-700 whitespace-pre-line leading-relaxed">
                Oi, Bruno! 👋{"\n"}
                Vi que você estava montando um pedido na Casa Roxa:{"\n"}
                • 1× Combo Costela Casal{"\n"}
                Total: R$ 199,90{"\n"}
                Quer finalizar? casaroxa.com.br/checkout
              </div>
            </div>
          )}

          {phase === "recovered" && (
            <div className="rounded-md border-2 border-roxa-300 bg-roxa-50 p-2 animate-slide-up">
              <p className="inline-flex items-center gap-1 text-[10px] font-bold text-roxa-900">
                <CheckCircle2 className="h-3 w-3" />
                Cliente voltou e finalizou — RECOVERED
              </p>
              <p className="text-[9px] text-roxa-700 mt-0.5">
                R$ 199,90 recuperados automaticamente
              </p>
            </div>
          )}
        </div>
      </PublicSiteShell>
    </BrowserFrame>
  );
}
