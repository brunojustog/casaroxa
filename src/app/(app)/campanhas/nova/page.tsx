import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { CampaignForm } from "@/components/campanhas/CampaignForm";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function NovaCampanhaPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="space-y-5">
      <Link
        href="/campanhas"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" /> Voltar para campanhas
      </Link>

      <PageHeader
        title="Nova campanha"
        description="Defina mensagem, público fixo e (opcional) cupom — cria como rascunho. Disparo é manual na próxima tela."
      />

      <Card>
        <CardContent className="p-6">
          <CampaignForm />
        </CardContent>
      </Card>
    </div>
  );
}
