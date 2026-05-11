"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { OtpLoginDialog } from "./OtpLoginDialog";

/** Botão "Entrar" + integração com o OtpLoginDialog pra autenticar em
 *  /meus-pedidos sem precisar mostrar o checkout. */
export function MyOrdersLogin() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-5 space-y-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700"
      >
        <MessageCircle className="h-4 w-4" />
        Entrar pelo WhatsApp
      </button>

      <OtpLoginDialog
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
