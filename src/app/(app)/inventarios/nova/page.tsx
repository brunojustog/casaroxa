import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { InventoryCreateForm } from "@/components/inventories/InventoryCreateForm";

export default function NovaContagemPage() {
  return (
    <div className="space-y-5">
      <Link
        href="/inventarios"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para inventário
      </Link>

      <PageHeader
        title="Nova contagem"
        description="Abre uma sessão de inventário. Você pode preencher com todos os ingredientes ativos ou começar vazio e ir adicionando."
      />

      <Card>
        <CardContent className="p-6">
          <InventoryCreateForm />
        </CardContent>
      </Card>
    </div>
  );
}
