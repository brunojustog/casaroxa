"use client";

import { useEffect, useState } from "react";
import { Send, Star } from "lucide-react";
import { BrowserFrame } from "../BrowserFrame";
import { PublicSiteShell } from "../PublicSiteShell";

export function NpsScreen() {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const loop = setInterval(() => {
      setSubmitted(false);
      setSelected(null);
      // simula clique em 9 (promotor)
      setTimeout(() => setSelected(9), 1000);
      setTimeout(() => setSubmitted(true), 2500);
    }, 5500);
    // Inicia primeira iteração imediatamente
    setTimeout(() => setSelected(9), 1000);
    setTimeout(() => setSubmitted(true), 2500);
    return () => clearInterval(loop);
  }, []);

  return (
    <BrowserFrame
      url="casaroxa.com.br/avaliacao/abc123"
      caption="Cliente recebe link após pedido entregue → escolhe nota 0-10 → mensagem de obrigado se adapta à categoria (detrator/passivo/promotor)."
    >
      <PublicSiteShell active="Cardápio">
        {!submitted ? (
          <div className="space-y-4 animate-fade-in">
            <header>
              <h1 className="font-serif text-lg font-bold text-roxa-900">
                Como foi seu pedido?
              </h1>
              <p className="text-[10px] text-slate-600">
                Pedido #1024 de 14 de maio
              </p>
            </header>

            <div>
              <p className="text-[11px] font-medium text-slate-800 mb-1">
                De 0 a 10, qual a chance de você recomendar a Casa Roxa pra alguém?
              </p>
              <p className="text-[9px] text-slate-500 mb-2">
                0 = nem pensar · 10 = com certeza
              </p>
              <div className="grid grid-cols-11 gap-0.5">
                {Array.from({ length: 11 }, (_, n) => {
                  const isSel = selected === n;
                  const tone =
                    n <= 6 ? "bg-red-600" : n <= 8 ? "bg-amber-500" : "bg-green-600";
                  return (
                    <button
                      key={n}
                      className={
                        isSel
                          ? `${tone} text-white rounded text-[10px] font-bold ring-2 ring-roxa-300 ring-offset-1 py-1 transition`
                          : "rounded border border-slate-200 bg-white py-1 text-[10px] font-semibold text-slate-700 transition"
                      }
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            <textarea
              className="w-full h-12 rounded border border-slate-300 px-2 py-1 text-[10px] text-slate-500"
              placeholder="Quer deixar um comentário? (opcional)"
              readOnly
            />

            <button
              className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-roxa-700 px-3 py-1.5 text-[11px] font-semibold text-white"
              disabled
            >
              <Send className="h-3 w-3" />
              Enviar avaliação
            </button>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4 text-center space-y-2 animate-slide-up">
            <Star className="mx-auto h-7 w-7 text-green-600" />
            <h2 className="font-serif text-base font-bold text-green-900">
              Avaliação enviada
            </h2>
            <p className="text-xs text-green-900">
              Que demais, Bruno! 💜 Obrigado por avaliar. Se quiser indicar
              alguém pra conhecer a Casa Roxa, é só mandar nosso link no
              WhatsApp!
            </p>
          </div>
        )}
      </PublicSiteShell>
    </BrowserFrame>
  );
}
