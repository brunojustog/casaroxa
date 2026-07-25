import type { Metadata } from "next";
import { PdvClienteDisplay } from "./PdvClienteDisplay";

export const metadata: Metadata = {
  title: "Casa Roxa — Acompanhe sua compra",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Tela do monitor voltado pro CLIENTE no balcão: mostra os itens sendo
 * bipados, o total, a forma de pagamento e o troco em tempo real.
 * Fora do grupo (app) de propósito — sem sidebar/header, tela limpa.
 * Abrir em tela cheia (F11) no segundo monitor do caixa.
 */
export default function PdvClientePage() {
  return <PdvClienteDisplay />;
}
