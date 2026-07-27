import { PageHeader } from "@/components/layout/PageHeader";
import { FiscalClient } from "@/components/fiscal/FiscalClient";
import {
  getFiscalConfig,
  listFiscalDocuments,
} from "@/server/services/fiscal.service";

export const dynamic = "force-dynamic";

export default async function FiscalPage() {
  const [config, docs] = await Promise.all([getFiscalConfig(), listFiscalDocuments()]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fiscal — NFC-e"
        description="Emissão de cupom fiscal eletrônico das vendas do PDV."
      />
      <FiscalClient
        config={config}
        docs={docs.map((d) => ({
          id: d.id,
          saleNumber: d.sale.number,
          customerName: d.sale.customerName,
          number: d.number,
          series: d.series,
          status: d.status,
          environment: d.environment,
          accessKey: d.accessKey,
          cpfCnpj: d.cpfCnpj,
          totalAmount: Number(d.totalAmount),
          errorMessage: d.errorMessage,
          createdAt: d.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
