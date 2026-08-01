import Link from "next/link";
import { CalendarClock, ChevronLeft, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { NewSaleForm } from "@/components/sales/NewSaleForm";

export default function NovaVendaPage() {
  return (
    <div className="space-y-5">
      <Link
        href="/vendas"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para vendas
      </Link>

      <PageHeader
        title="Nova venda"
        description="Cadastre o cabeçalho da venda. Você adiciona itens e pagamentos na próxima tela."
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/pdv"
          className="inline-flex items-center gap-1.5 rounded-lg border border-roxa-200 bg-roxa-50 px-3 py-2 text-roxa-800 hover:bg-roxa-100"
        >
          <Zap className="h-4 w-4" />
          Cliente no balcão? <strong>Use o PDV</strong> — bem mais rápido
        </Link>
        <Link
          href="/encomendas"
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 hover:bg-amber-100"
        >
          <CalendarClock className="h-4 w-4" />
          Pedido pra outro dia? <strong>Registre como Encomenda</strong>
        </Link>
      </div>

      <Card>
        <CardContent className="p-6">
          <NewSaleForm />
        </CardContent>
      </Card>
    </div>
  );
}
