import { PageHeader } from "@/components/layout/PageHeader";
import { SupplyTripManager } from "@/components/viagens/SupplyTripManager";
import { listSupplyTrips } from "@/server/services/supply-trip.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Viagens do empório" };

export default async function ViagensPage() {
  const trips = await listSupplyTrips();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Viagens do empório"
        description="Idas a Minas pra buscar mercadoria (~2x/mês). As encomendas do empório no site ficam atreladas à próxima viagem agendada — sem viagem aberta, o site orienta o cliente pro grupo do WhatsApp."
      />
      <SupplyTripManager
        trips={trips.map((t) => ({
          id: t.id,
          tripDate: t.tripDate.toISOString(),
          cutoffAt: t.cutoffAt.toISOString(),
          status: t.status,
          notes: t.notes,
          orderCount: t._count.orderRequests,
        }))}
      />
    </div>
  );
}
