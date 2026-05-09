import { notFound } from "next/navigation";
import { getInventoryById } from "@/server/services/inventory.service";
import { INGREDIENT_UNIT_LABEL, INGREDIENT_CATEGORY_LABEL } from "@/lib/enums";
import { PrintTrigger } from "@/components/inventories/PrintTrigger";

export const dynamic = "force-dynamic";

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

const fmtQty = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(v);

/**
 * Página print-friendly da contagem. Layout pensado pra imprimir em A4
 * e usar offline na cozinha — uma linha por ingrediente, com espaço
 * pra escrever a quantidade contada à mão.
 *
 * Acessada via botão "Imprimir lista" na página de detalhe.
 */
export default async function InventarioPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inv = await getInventoryById(id);
  if (!inv) notFound();

  // Agrupa por categoria pra facilitar a contagem física
  const byCategory = new Map<string, typeof inv.items>();
  for (const it of inv.items) {
    const cat = it.ingredient.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(it);
  }
  const categories = Array.from(byCategory.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <div className="bg-white">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-table tbody tr { page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between p-4 border-b border-slate-200">
        <div>
          <a
            href={`/inventarios/${inv.id}`}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            ← Voltar pra contagem
          </a>
          <h1 className="text-lg font-semibold text-slate-900 mt-1">
            Lista pra impressão
          </h1>
          <p className="text-xs text-slate-500">
            Imprima e use na cozinha pra contar offline. Depois transcreva no sistema.
          </p>
        </div>
        <PrintTrigger />
      </div>

      <div className="max-w-[210mm] mx-auto px-6 py-4 print:p-0">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">
            Casa Roxa — Contagem de Estoque
          </h1>
          <p className="text-sm text-slate-700 mt-1">
            <strong>{inv.name}</strong>
          </p>
          <p className="text-xs text-slate-600">
            Iniciado por {inv.createdBy.name} em {fmtDateTime(inv.startedAt)}
          </p>
          {inv.notes && (
            <p className="text-xs text-slate-600 mt-1">{inv.notes}</p>
          )}
        </header>

        {inv.items.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            Nenhum item nesta contagem.
          </p>
        ) : (
          <div className="space-y-6">
            {categories.map(([cat, items]) => (
              <section key={cat}>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-300 pb-1 mb-2">
                  {INGREDIENT_CATEGORY_LABEL[cat as never] ?? cat} · {items.length}{" "}
                  item{items.length === 1 ? "" : "s"}
                </h2>
                <table className="w-full text-xs print-table">
                  <thead>
                    <tr className="text-slate-600 text-[10px] uppercase tracking-wider">
                      <th className="text-left py-1.5 pr-2 font-semibold w-[55%]">
                        Ingrediente
                      </th>
                      <th className="text-right py-1.5 px-2 font-semibold w-[15%]">
                        Sistema
                      </th>
                      <th className="text-left py-1.5 px-2 font-semibold w-[12%]">
                        Unidade
                      </th>
                      <th className="text-left py-1.5 pl-2 font-semibold w-[18%]">
                        Contado (escrever)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr
                        key={it.id}
                        className="border-t border-slate-200"
                      >
                        <td className="py-2 pr-2 text-slate-900">
                          {it.ingredient.name}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-700">
                          {fmtQty(Number(it.expectedQuantity))}
                        </td>
                        <td className="py-2 px-2 text-slate-600">
                          {INGREDIENT_UNIT_LABEL[it.ingredient.unit]}
                        </td>
                        <td className="py-2 pl-2">
                          <div className="border-b border-slate-400 h-5 w-full" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-8 pt-4 border-t border-slate-300 text-xs text-slate-500">
          <p>
            Total de itens: <strong>{inv.items.length}</strong> · Lista gerada em{" "}
            {fmtDateTime(new Date())}
          </p>
          <p className="mt-2">
            Quem contou: __________________________________ Assinatura:
            __________________________________
          </p>
        </footer>
      </div>
    </div>
  );
}
