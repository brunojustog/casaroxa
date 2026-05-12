"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

/**
 * Detecta `?ref=customerId` na URL e seta cookie httpOnly via API. Depois
 * remove o `?ref` da URL pra não vazar o ID em compartilhamentos
 * recursivos. Roda silenciosamente.
 */
export function ReferralTracker({ raffleId }: { raffleId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ref = searchParams.get("ref");

  useEffect(() => {
    if (!ref) return;
    void fetch("/api/public/referral/set-cookie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref, raffleId }),
    })
      .catch(() => {
        /* silencioso — referrer inválido não bloqueia o usuário */
      })
      .finally(() => {
        // Remove ?ref da URL pra não vazar em compartilhamentos posteriores
        const next = new URLSearchParams(searchParams.toString());
        next.delete("ref");
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      });
  }, [ref, raffleId, router, pathname, searchParams]);

  return null;
}
