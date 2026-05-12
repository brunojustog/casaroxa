import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PaymentClient } from "@/components/public/checkout/PaymentClient";

export const dynamic = "force-dynamic";

export default async function CheckoutPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { saleId } = await params;
  const sp = await searchParams;
  const initialMethod =
    typeof sp.method === "string" && (sp.method === "PIX" || sp.method === "CREDIT_CARD")
      ? sp.method
      : "PIX";

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      number: true,
      status: true,
      totalRevenue: true,
      couponDiscount: true,
      customerName: true,
    },
  });
  if (!sale) notFound();

  const total = Number(sale.totalRevenue) - Number(sale.couponDiscount);

  return (
    <div className="mx-auto max-w-md py-2 space-y-5">
      <header>
        <p className="text-xs uppercase tracking-wider text-slate-500">
          Pedido #{sale.number}
        </p>
        <h1 className="font-serif text-2xl font-bold text-roxa-900">
          Pagar online
        </h1>
        <p className="text-sm text-slate-600">
          {sale.customerName ?? "Cliente"} ·{" "}
          <strong>
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(total)}
          </strong>
        </p>
      </header>

      <PaymentClient subject={{ kind: "sale", saleId, initialMethod }} />
    </div>
  );
}
