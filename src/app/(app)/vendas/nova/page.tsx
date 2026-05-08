import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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

      <Card>
        <CardContent className="p-6">
          <NewSaleForm />
        </CardContent>
      </Card>
    </div>
  );
}
