import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { UserForm } from "@/components/users/UserForm";
import { auth } from "@/server/auth";

export default async function NovoUsuarioPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="space-y-5">
      <Link
        href="/usuarios"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para usuários
      </Link>

      <PageHeader
        title="Novo usuário"
        description="Crie um login pra alguém que vai usar o sistema."
      />

      <Card>
        <CardContent className="p-6">
          <UserForm mode={{ type: "create" }} />
        </CardContent>
      </Card>
    </div>
  );
}
