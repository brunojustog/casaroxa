import { PageHeader } from "@/components/layout/PageHeader";
import { KdsBoard } from "@/components/kds/KdsBoard";

export const dynamic = "force-dynamic";

export default function CozinhaPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Cozinha"
        description="Painel de produção — pedidos ativos, atualizados em tempo real."
      />
      <KdsBoard />
    </div>
  );
}
