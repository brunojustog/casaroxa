import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ProductForm } from "@/components/products/ProductForm";

export default function NovoProdutoPage() {
  return (
    <div className="space-y-5">
      <Link
        href="/produtos"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para produtos
      </Link>

      <PageHeader
        title="Novo produto"
        description="Cadastre o produto. A ficha técnica (e portanto o custo) é montada depois, na tela de Fichas Técnicas."
      />

      <Card>
        <CardContent className="p-6">
          <ProductForm mode={{ type: "create" }} />
        </CardContent>
      </Card>
    </div>
  );
}
