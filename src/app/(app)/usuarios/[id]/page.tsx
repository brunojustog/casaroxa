import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserForm } from "@/components/users/UserForm";
import { getUserById } from "@/server/services/user.service";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();

  const isSelf = session.user.id === user.id;

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
        title={user.name}
        description={user.email}
        actions={
          <div className="flex items-center gap-2">
            {user.role === "ADMIN" ? (
              <Badge tone="warning">Administrador</Badge>
            ) : (
              <Badge tone="info">Operador</Badge>
            )}
            {user.active ? (
              <Badge tone="success">Ativo</Badge>
            ) : (
              <Badge tone="neutral">Inativo</Badge>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="p-6">
          <UserForm
            mode={{ type: "edit", id: user.id, isSelf }}
            defaultValues={{
              name: user.name,
              email: user.email,
              role: user.role,
              active: user.active,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
