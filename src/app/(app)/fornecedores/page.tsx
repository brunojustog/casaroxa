import Link from "next/link";
import { Plus, Search } from "lucide-react";
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
import { SupplierRowActions } from "@/components/suppliers/SupplierRowActions";
import { listSuppliers } from "@/server/services/supplier.service";
import { supplierListFiltersSchema } from "@/schemas/supplier.schema";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = supplierListFiltersSchema.parse({
    search: typeof params.search === "string" ? params.search : undefined,
    active: typeof params.active === "string" ? params.active : "active",
  });

  const suppliers = await listSuppliers(filters);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fornecedores"
        description="Cadastro de fornecedores. Usados nas compras e na importação de NFe."
        actions={
          <Link
            href="/fornecedores/novo"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-roxa-700 px-4 text-sm font-medium text-white hover:bg-roxa-800"
          >
            <Plus className="h-4 w-4" />
            Novo fornecedor
          </Link>
        }
      />

      <form className="flex flex-wrap items-center gap-2" action="/fornecedores">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            name="search"
            defaultValue={filters.search ?? ""}
            placeholder="Buscar por nome, CNPJ, contato…"
            className="pl-8 w-72"
          />
        </div>
        <Select name="active" defaultValue={filters.active} className="w-36">
          <option value="active">Apenas ativos</option>
          <option value="inactive">Apenas inativos</option>
          <option value="all">Todos</option>
        </Select>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          Filtrar
        </button>
      </form>

      {suppliers.length === 0 ? (
        <EmptyState>
          Nenhum fornecedor cadastrado.{" "}
          <Link href="/fornecedores/novo" className="text-roxa-700 hover:underline">
            Cadastrar o primeiro
          </Link>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nome</TH>
              <TH>CNPJ</TH>
              <TH>Contato</TH>
              <TH>Telefone</TH>
              <TH className="text-center">Compras</TH>
              <TH>Status</TH>
              <TH className="text-right pr-4">Ações</TH>
            </TR>
          </THead>
          <TBody>
            {suppliers.map((s) => (
              <TR key={s.id}>
                <TD className="font-medium text-slate-900">
                  <Link href={`/fornecedores/${s.id}`} className="hover:text-roxa-700">
                    {s.name}
                  </Link>
                </TD>
                <TD className="text-slate-600 text-xs">{s.cnpj ?? "—"}</TD>
                <TD className="text-slate-600">{s.contactPerson ?? "—"}</TD>
                <TD className="text-slate-600 text-xs">{s.phone ?? "—"}</TD>
                <TD className="text-center text-slate-700 tabular-nums">
                  {s._count.purchases}
                </TD>
                <TD>
                  {s.active ? (
                    <Badge tone="success">Ativo</Badge>
                  ) : (
                    <Badge tone="neutral">Inativo</Badge>
                  )}
                </TD>
                <TD className="text-right pr-2">
                  <SupplierRowActions id={s.id} active={s.active} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <div className="text-xs text-slate-500">
        {suppliers.length} fornecedor{suppliers.length === 1 ? "" : "es"}
      </div>
    </div>
  );
}
