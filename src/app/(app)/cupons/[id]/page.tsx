import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CouponForm } from "@/components/coupons/CouponForm";
import { getCouponById } from "@/server/services/coupon.service";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function EditarCupomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const c = await getCouponById(id);
  if (!c) notFound();

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
        title={c.code}
        description={
          c.description ?? `${c.usedCount} uso${c.usedCount === 1 ? "" : "s"}`
        }
        actions={
          c.active ? (
            <Badge tone="success">Ativo</Badge>
          ) : (
            <Badge tone="neutral">Inativo</Badge>
          )
        }
      />

      <Card>
        <CardContent className="p-6">
          <CouponForm
            mode={{ type: "edit", id: c.id }}
            defaultValues={{
              code: c.code,
              description: c.description,
              type: c.type,
              value: Number(c.value),
              maxUses: c.maxUses,
              minOrderAmount:
                c.minOrderAmount === null ? null : Number(c.minOrderAmount),
              validFrom: c.validFrom,
              validUntil: c.validUntil,
              active: c.active,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
