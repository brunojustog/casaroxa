import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerForm } from "@/components/customers/CustomerForm";

export default function NovoClientePage() {
  return (
    <div className="space-y-5">
      <Link
        href="/clientes"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para clientes
      </Link>

      <PageHeader
        title="Novo cliente"
        description="Cadastre manualmente. (Clientes que pedirem pelo site são adicionados sozinhos.)"
      />

      <Card>
        <CardContent className="p-6">
          <CustomerForm mode={{ type: "create" }} />
        </CardContent>
      </Card>
    </div>
  );
}
