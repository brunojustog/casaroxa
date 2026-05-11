import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { RaffleForm } from "@/components/raffles/RaffleForm";
import { auth } from "@/server/auth";

export default async function NovoSorteioPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="space-y-5">
      <Link
        href="/sorteios"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para sorteios
      </Link>

      <PageHeader
        title="Novo sorteio"
        description="Crie como Rascunho pra revisar, depois marque como Aberto pra começar a aceitar inscrições."
      />

      <Card>
        <CardContent className="p-6">
          <RaffleForm mode={{ type: "create" }} />
        </CardContent>
      </Card>
    </div>
  );
}
