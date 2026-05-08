import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { SupplierForm } from "@/components/suppliers/SupplierForm";

export default function NovoFornecedorPage() {
  return (
    <div className="space-y-5">
      <Link
        href="/fornecedores"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para fornecedores
      </Link>

      <PageHeader
        title="Novo fornecedor"
        description="Cadastre o fornecedor para usar nas compras."
      />

      <Card>
        <CardContent className="p-6">
          <SupplierForm mode={{ type: "create" }} />
        </CardContent>
      </Card>
    </div>
  );
}
