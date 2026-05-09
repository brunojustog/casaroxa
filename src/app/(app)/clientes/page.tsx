import Link from "next/link";
import { Cake, Plus, Search, UsersRound } from "lucide-react";
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
import { CustomerRowActions } from "@/components/customers/CustomerRowActions";
import { listCustomers } from "@/server/services/customer.service";
import { customerListFiltersSchema } from "@/schemas/customer.schema";

export const dynamic = "force-dynamic";

const fmtPhone = (p: string) => {
  const digits = p.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return p;
};

const fmtDateBr = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(d);

const MONTHS = [
  ["01", "Janeiro"],
  ["02", "Fevereiro"],
  ["03", "Março"],
  ["04", "Abril"],
  ["05", "Maio"],
  ["06", "Junho"],
  ["07", "Julho"],
  ["08", "Agosto"],
  ["09", "Setembro"],
  ["10", "Outubro"],
  ["11", "Novembro"],
  ["12", "Dezembro"],
] as const;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = customerListFiltersSchema.parse({
    search: typeof params.search === "string" ? params.search : undefined,
    active: typeof params.active === "string" ? params.active : "active",
    birthdayMonth:
      typeof params.birthdayMonth === "string" ? params.birthdayMonth : undefined,
  });

  const customers = await listCustomers(filters);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientes"
        description="Cadastro de clientes da Casa Roxa. Cresce sozinho a cada pedido pelo cardápio público — pelo telefone."
        actions={
          <Link
            href="/clientes/novo"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-roxa-700 px-4 text-sm font-medium text-white hover:bg-roxa-800"
          >
            <Plus className="h-4 w-4" />
            Novo cliente
          </Link>
        }
      />

      <form className="flex flex-wrap items-center gap-2" action="/clientes">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            name="search"
            defaultValue={filters.search ?? ""}
            placeholder="Buscar por nome ou telefone…"
            className="pl-8 w-72"
          />
        </div>
        <Select name="active" defaultValue={filters.active} className="w-36">
          <option value="active">Apenas ativos</option>
          <option value="inactive">Apenas inativos</option>
          <option value="all">Todos</option>
        </Select>
        <Select
          name="birthdayMonth"
          defaultValue={filters.birthdayMonth ?? ""}
          className="w-44"
        >
          <option value="">Aniversário (qualquer mês)</option>
          {MONTHS.map(([v, l]) => (
            <option key={v} value={v}>
              🎂 {l}
            </option>
          ))}
        </Select>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          Filtrar
        </button>
      </form>

      {customers.length === 0 ? (
        <EmptyState>
          <UsersRound className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          Nenhum cliente cadastrado.{" "}
          <Link href="/clientes/novo" className="text-roxa-700 hover:underline">
            Cadastrar o primeiro
          </Link>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nome</TH>
              <TH>Telefone</TH>
              <TH>Bairro</TH>
              <TH className="text-center">Pedidos</TH>
              <TH>Aniversário</TH>
              <TH>Status</TH>
              <TH className="text-right pr-4">Ações</TH>
            </TR>
          </THead>
          <TBody>
            {customers.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium text-slate-900">
                  <Link href={`/clientes/${c.id}`} className="hover:text-roxa-700">
                    {c.name}
                  </Link>
                </TD>
                <TD className="text-slate-600 text-xs tabular-nums">
                  {fmtPhone(c.phone)}
                </TD>
                <TD className="text-slate-600 text-xs">
                  {c.neighborhood ?? "—"}
                </TD>
                <TD className="text-center text-slate-700 tabular-nums">
                  {c._count.sales}
                </TD>
                <TD className="text-slate-600 text-xs">
                  {c.birthday ? (
                    <span className="inline-flex items-center gap-1">
                      <Cake className="h-3 w-3 text-roxa-500" />
                      {fmtDateBr(c.birthday)}
                    </span>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD>
                  {c.active ? (
                    <Badge tone="success">Ativo</Badge>
                  ) : (
                    <Badge tone="neutral">Inativo</Badge>
                  )}
                </TD>
                <TD className="text-right pr-2">
                  <CustomerRowActions
                    id={c.id}
                    active={c.active}
                    hasSales={c._count.sales > 0}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <div className="text-xs text-slate-500">
        {customers.length} cliente{customers.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
