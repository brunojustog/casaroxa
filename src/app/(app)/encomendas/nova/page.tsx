import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { OrderRequestForm } from "@/components/order-requests/OrderRequestForm";
import { prisma } from "@/lib/prisma";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function NovaEncomendaPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [products, combos] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, salePrice: { gt: 0 } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, salePrice: true },
    }),
    prisma.combo.findMany({
      where: { active: true, salePrice: { gt: 0 } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, salePrice: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <Link
        href="/encomendas"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" /> Voltar para encomendas
      </Link>

      <PageHeader
        title="Nova encomenda"
        description="Cliente ligou ou pediu pelo WhatsApp — registre aqui. Site público tem fluxo próprio em /encomenda."
      />

      <Card>
        <CardContent className="p-6">
          <OrderRequestForm
            catalog={{
              products: products.map((p) => ({
                id: p.id,
                name: p.name,
                salePrice: Number(p.salePrice ?? 0),
              })),
              combos: combos.map((c) => ({
                id: c.id,
                name: c.name,
                salePrice: Number(c.salePrice ?? 0),
              })),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
