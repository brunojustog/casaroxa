import Link from "next/link";
import { MenuItemCard } from "@/components/public/MenuItemCard";
import { getPublicMenu, getSiteSettings } from "@/server/services/public-menu.service";

export const dynamic = "force-dynamic";

export default async function CardapioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const selectedCat = typeof sp.cat === "string" ? sp.cat : null;

  const [menu, settings] = await Promise.all([getPublicMenu(), getSiteSettings()]);

  const filtered = selectedCat
    ? menu.filter((c) => String(c.category) === selectedCat)
    : menu;
  const totalItems = filtered.reduce((acc, c) => acc + c.items.length, 0);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-4xl font-bold text-roxa-900">Cardápio</h1>
        <p className="text-sm text-slate-600">
          {totalItems > 0
            ? `${totalItems} item${totalItems === 1 ? "" : "s"} disponível${totalItems === 1 ? "" : "s"}.`
            : "Cardápio em preparação."}
          {settings.minimumOrderValue && settings.minimumOrderValue > 0 && (
            <>
              {" "}Pedido mínimo:{" "}
              <strong>
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(settings.minimumOrderValue)}
              </strong>
              .
            </>
          )}
        </p>
      </header>

      {/* Filtros de categoria */}
      {menu.length > 1 && (
        <nav className="flex flex-wrap gap-2">
          <CategoryChip href="/cardapio" active={!selectedCat}>
            Todos
          </CategoryChip>
          {menu.map((cat) => (
            <CategoryChip
              key={cat.category}
              href={`/cardapio?cat=${encodeURIComponent(String(cat.category))}`}
              active={selectedCat === String(cat.category)}
            >
              {cat.label}
              <span className="ml-1.5 rounded-full bg-roxa-50 px-1.5 py-0.5 text-[10px] font-semibold text-roxa-700">
                {cat.items.length}
              </span>
            </CategoryChip>
          ))}
        </nav>
      )}

      {/* Cards agrupados por categoria */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-roxa-200 bg-white p-10 text-center text-sm text-slate-600">
          Nada por aqui ainda. Volte em breve!
        </div>
      ) : (
        filtered.map((cat) => (
          <section key={cat.category} className="space-y-4">
            <h2 className="font-serif text-2xl font-bold text-roxa-900">{cat.label}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cat.items.map((item) => (
                <MenuItemCard key={`${item.kind}-${item.id}`} item={item} />
              ))}
            </div>
          </section>
        ))
      )}

    </div>
  );
}

function CategoryChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "inline-flex items-center rounded-full bg-roxa-700 px-4 py-2 text-sm font-medium text-white"
          : "inline-flex items-center rounded-full border border-roxa-200 bg-white px-4 py-2 text-sm font-medium text-roxa-800 hover:bg-roxa-50"
      }
    >
      {children}
    </Link>
  );
}
