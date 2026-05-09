import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { CouponForm } from "@/components/coupons/CouponForm";
import { auth } from "@/server/auth";

export default async function NovoCupomPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="space-y-5">
      <Link
        href="/cupons"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para cupons
      </Link>

      <PageHeader
        title="Novo cupom"
        description="Cadastre um código promocional pra usar no cardápio público."
      />

      <Card>
        <CardContent className="p-6">
          <CouponForm mode={{ type: "create" }} />
        </CardContent>
      </Card>
    </div>
  );
}
