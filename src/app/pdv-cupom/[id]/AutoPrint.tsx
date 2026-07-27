"use client";

import { useEffect } from "react";

/** Dispara a impressão ao abrir e liga o botão "Imprimir novamente". */
export function AutoPrint() {
  useEffect(() => {
    const btn = document.getElementById("btn-print");
    const print = () => window.print();
    btn?.addEventListener("click", print);
    // pequeno delay pra garantir fontes/layout prontos
    const t = setTimeout(print, 300);
    return () => {
      clearTimeout(t);
      btn?.removeEventListener("click", print);
    };
  }, []);
  return null;
}
