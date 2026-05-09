import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  EmptyState,
} from "@/components/ui/table";
import { UserRowActions } from "@/components/users/UserRowActions";
import { listUsers } from "@/server/services/user.service";
import { userListFiltersSchema } from "@/schemas/user.schema";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  OPERADOR: "Operador",
};

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const filters = userListFiltersSchema.parse({
    search: typeof params.search === "string" ? params.search : undefined,
    active: typeof params.active === "string" ? params.active : "all",
  });

  const users = await listUsers(filters);
  const meId = session.user.id;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuários"
        description="Quem pode entrar no sistema. ADMIN vê tudo; OPERADOR só áreas operacionais."
        actions={
          <Link
            href="/usuarios/novo"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-roxa-700 px-4 text-sm font-medium text-white hover:bg-roxa-800"
          >
            <Plus className="h-4 w-4" />
            Novo usuário
          </Link>
        }
      />

      <form className="flex flex-wrap items-center gap-2" action="/usuarios">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            name="search"
            defaultValue={filters.search ?? ""}
            placeholder="Buscar por nome ou e-mail…"
            className="pl-8 w-72"
          />
        </div>
        <Select name="active" defaultValue={filters.active} className="w-36">
          <option value="all">Todos</option>
          <option value="active">Apenas ativos</option>
          <option value="inactive">Apenas inativos</option>
        </Select>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          Filtrar
        </button>
      </form>

      {users.length === 0 ? (
        <EmptyState>
          Nenhum usuário encontrado.{" "}
          <Link href="/usuarios/novo" className="text-roxa-700 hover:underline">
            Cadastrar o primeiro
          </Link>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nome</TH>
              <TH>E-mail</TH>
              <TH>Perfil</TH>
              <TH>Status</TH>
              <TH className="text-right pr-4">Ações</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((u) => {
              const isSelf = u.id === meId;
              return (
                <TR key={u.id}>
                  <TD className="font-medium text-slate-900">
                    <Link href={`/usuarios/${u.id}`} className="hover:text-roxa-700">
                      {u.name}
                      {isSelf && (
                        <span className="ml-2 text-xs font-normal text-slate-400">(você)</span>
                      )}
                    </Link>
                  </TD>
                  <TD className="text-slate-600 text-xs">{u.email}</TD>
                  <TD>
                    {u.role === "ADMIN" ? (
                      <Badge tone="warning">{ROLE_LABEL[u.role]}</Badge>
                    ) : (
                      <Badge tone="info">{ROLE_LABEL[u.role]}</Badge>
                    )}
                  </TD>
                  <TD>
                    {u.active ? (
                      <Badge tone="success">Ativo</Badge>
                    ) : (
                      <Badge tone="neutral">Inativo</Badge>
                    )}
                  </TD>
                  <TD className="text-right pr-2">
                    <UserRowActions id={u.id} active={u.active} isSelf={isSelf} />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <div className="text-xs text-slate-500">
        {users.length} usuário{users.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
