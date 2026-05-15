"use client";

import { useEffect, useRef } from "react";

/**
 * Renderiza um diagrama Mermaid inline. Lazy-load do lib pra não inflar
 * o bundle inicial.
 */
export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef(
    `mmd-${Math.random().toString(36).slice(2, 10)}`,
  );

  useEffect(() => {
    let cancelled = false;
    import("mermaid").then((mod) => {
      if (cancelled || !ref.current) return;
      mod.default.initialize({
        startOnLoad: false,
        theme: "default",
        themeVariables: {
          primaryColor: "#f3e8ff",
          primaryTextColor: "#581c87",
          primaryBorderColor: "#a855f7",
          lineColor: "#7e22ce",
          fontFamily: "system-ui",
        },
      });
      mod.default.render(idRef.current, chart).then(({ svg }) => {
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [chart]);

  return (
    <div
      ref={ref}
      className="my-6 flex justify-center overflow-x-auto rounded-md border border-slate-200 bg-white p-4"
    />
  );
}
