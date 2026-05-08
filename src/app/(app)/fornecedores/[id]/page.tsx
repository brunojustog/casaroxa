import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SupplierForm } from "@/components/suppliers/SupplierForm";
import { getSupplierById } from "@/server/services/supplier.service";

export const dynamic = "force-dynamic";

export default async function EditarFornecedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await getSupplierById(id);
  if (!supplier) notFound();

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
        title={supplier.name}
        description={supplier.cnpj ?? "Sem CNPJ cadastrado"}
        actions={
          supplier.active ? (
            <Badge tone="success">Ativo</Badge>
          ) : (
            <Badge tone="neutral">Inativo</Badge>
          )
        }
      />

      <Card>
        <CardContent className="p-6">
          <SupplierForm
            mode={{ type: "edit", id: supplier.id }}
            defaultValues={{
              name: supplier.name,
              cnpj: supplier.cnpj,
              contactPerson: supplier.contactPerson,
              phone: supplier.phone,
              email: supplier.email,
              notes: supplier.notes,
              active: supplier.active,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
