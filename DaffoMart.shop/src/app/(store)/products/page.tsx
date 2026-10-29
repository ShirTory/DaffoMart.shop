import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/store/ProductCard";
import EmptyState from "@/components/store/EmptyState";
import FilterLayout from "@/components/store/FilterLayout";
import { getActiveProducts, getCategories, getSettings } from "@/server/queries";
import { makeT } from "@/lib/texts";
import { validHex } from "@/lib/theme";
import { pageMeta } from "@/lib/seo";
const PER = 24;

type SP = { q?: string; cat?: string; sort?: string; max?: string; sale?: string; featured?: string; page?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams; const [categories, st] = await Promise.all([getCategories(), getSettings()]);
  const c = sp.cat ? categories.find((x) => x.id === sp.cat) : undefined;
  const filtered = Boolean(sp.q || sp.sort || sp.max || sp.sale || sp.featured || sp.page);
  const title = c ? (c.coverTitle || c.name) : sp.sale ? makeT(st.texts)("products.sale") : sp.featured ? makeT(st.texts)("products.featured") : makeT(st.texts)("products.all");
  const desc = c?.description || `Shop ${c ? c.name : "groceries, medicines and everyday essentials"} at ${st.storeName}.`;
  return pageMeta({ title, description: desc, path: c && !filtered ? `/products?cat=${c.id}` : "/products", image: c?.coverImage || c?.image, noindex: filtered });
}

const OVERLAY: Record<string, string> = {
  dark: "bg-black/50",
  medium: "bg-black/35",
  light: "bg-black/20",
  none: "bg-transparent",
};
// compact on phones so the first row of products stays visible under the banner
const HEIGHT: Record<string, string> = {
  sm: "h-24 sm:h-28 md:h-32",
  md: "h-32 sm:h-40 md:h-48",
  lg: "h-40 sm:h-52 md:h-60",
};
const POS: Record<string, string> = { top: "object-top", center: "object-center", bottom: "object-bottom" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { q = "", cat = "", sort = "", max = "", sale = "", featured = "" } = sp;
  const page = Math.max(1, Number(sp.page) || 1);
  const [all, categories, settings] = await Promise.all([getActiveProducts(), getCategories(), getSettings()]);
  let list = all.filter(
    (p) =>
      p.name.toLowerCase().includes(q.toLowerCase()) &&
      (!cat || p.categoryId === cat) &&
      (!max || p.price <= Number(max)) &&
      (!sale || (p.oldPrice && p.oldPrice > p.price)) &&
      (!featured || p.featured)
  );
  if (sort === "price_asc") list.sort((a, b) => a.price - b.price);
  else if (sort === "price_desc") list.sort((a, b) => b.price - a.price);
  else if (sort === "popular") list.sort((a, b) => b.sold - a.sold);
  else list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PER));
  list = list.slice((page - 1) * PER, page * PER);
  const link = (o: Record<string, string>) => {
    const p = new URLSearchParams(
      Object.entries({ q, cat, sort, max, sale, featured, ...o }).filter(([, v]) => v) as [string, string][]
    );
    const s = p.toString();
    return `/products${s ? `?${s}` : ""}`;
  };
  const activeCat = cat ? categories.find((c) => c.id === cat) : null;
  const t = makeT(settings.texts);
  const heading = sale ? t("products.sale") : featured ? t("products.featured") : activeCat ? (activeCat.coverTitle || activeCat.name) : t("products.all");
  const chip = (active: boolean) =>
    `rounded-lg px-3 py-1.5 transition ${active ? "bg-primary text-white" : "bg-gray-50 text-gray-700 hover:bg-primary-soft"}`;

  const heightCls = HEIGHT[activeCat?.coverHeight || "md"] || HEIGHT.md;
  const overlayCls = OVERLAY[activeCat?.coverOverlay || "medium"] || OVERLAY.medium;
  const filtersOn = Boolean(q || max || sale || featured);
  const emptyKind = all.length === 0 ? "none" : activeCat && !filtersOn ? "category" : "search";

  return (
    <FilterLayout count={[cat, max, sort, sale, featured].filter(Boolean).length} label={t("products.filters")} title={t("products.filters")} doneLabel={t("products.showResults")} filters={<>
        <div>
          <h3 className="mb-3 font-bold">{t("products.categories")}</h3>
          <div className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            <Link href={link({ cat: "", page: "" })} className={chip(!cat)}>{t("header.all")}</Link>
            {categories.map((c) => (
              <Link key={c.id} href={link({ cat: c.id, page: "" })} className={chip(cat === c.id)}>
                {c.emoji} {c.name}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 font-bold">{t("products.price")}</h3>
          <div className="flex flex-wrap gap-2">
            {["", "100", "300", "500", "1000"].map((m) => (
              <Link key={m} href={link({ max: m, page: "" })} className={chip(max === m)}>
                {m ? `৳${m}` : "Any"}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 font-bold">{t("products.sort")}</h3>
          <div className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {[
              ["", "Newest"],
              ["price_asc", "Price: low to high"],
              ["price_desc", "Price: high to low"],
              ["popular", "Most popular"],
            ].map(([v, l]) => (
              <Link key={v} href={link({ sort: v, page: "" })} className={chip(sort === v)}>{l}</Link>
            ))}
          </div>
        </div>
      </>}>

      <section>
        {activeCat && (
          <div className="mb-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className={`relative ${heightCls} bg-gradient-to-br from-primary to-primary-dark`} style={validHex(activeCat.coverBg) ? { background: validHex(activeCat.coverBg) } : undefined}>
              {activeCat.coverImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeCat.coverImage} alt={activeCat.name} className={`absolute inset-0 h-full w-full object-cover ${POS[activeCat.coverPosition || "center"] ?? POS.center}`} fetchPriority="high" decoding="async" />
                  <div className={`absolute inset-0 ${overlayCls}`} />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-90 sm:text-6xl" aria-hidden>{activeCat.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={activeCat.image} alt="" className="h-20 w-20 rounded-2xl bg-white/90 object-cover p-1 sm:h-24 sm:w-24" />
                ) : (activeCat.emoji || "🛍️")}</div>
              )}
            </div>
            <div className="px-4 py-3 sm:px-5" style={{ color: validHex(activeCat.coverTextColor) || undefined }}>
              <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{activeCat.coverTitle || activeCat.name}</h1>
              {activeCat.description && <p className="mt-0.5 line-clamp-2 text-sm opacity-80 sm:line-clamp-3">{activeCat.description}</p>}
              <p className="mt-1 text-xs opacity-60">{total} product{total === 1 ? "" : "s"}</p>
            </div>
          </div>
        )}

        {!activeCat && (
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {heading}
              {q && <span className="ml-2 text-base font-normal text-gray-500">for “{q}”</span>}
            </h1>
            <p className="text-sm text-gray-500">{total} product{total === 1 ? "" : "s"}</p>
          </div>
        )}

        {list.length === 0 ? (
          <EmptyState kind={emptyKind} settings={settings} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
            {list.map((p) => (
              <ProductCard key={p.id} p={p} whatsapp={settings.whatsapp} />
            ))}
          </div>
        )}

        {pages > 1 && (
          <nav className="mt-8 flex flex-wrap justify-center gap-2" aria-label="Pagination">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={link({ page: String(n) })}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-semibold ${
                  n === page ? "border-primary bg-primary text-white" : "bg-white hover:bg-primary-soft"
                }`}
              >
                {n}
              </Link>
            ))}
          </nav>
        )}
      </section>
    </FilterLayout>
  );
}
