"use client";
import Link from "next/link";
import Logo from "./Logo";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/store";
import { useWishlist } from "@/lib/wishlist";
import type { Category, StoreSettings } from "@/lib/types";
import NotificationBell from "./NotificationBell";
import AnnouncementBar from "./AnnouncementBar";
import { useFlags, useT } from "./TextsProvider";
import { CategoryChip } from "./CategoryIcon";
import { luminance, readableOn, rgb, validHex } from "@/lib/theme";

const Icon = ({ d, className = "h-[22px] w-[22px]" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
const SEARCH = "M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z";
const HEART = "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z";
const CART = "M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 7H6M10 21h.01M18 21h.01";
const CROSS = "M12 5v14M5 12h14";

/** Header colours: light (white) by default, or brand (deep colour). A custom colour is allowed and text colour follows it automatically. */
function headerTone(s: StoreSettings) {
  const custom = validHex(s.headerBg);
  const brand = s.headerTheme === "brand";
  const dark = custom ? luminance(rgb(custom, "#ffffff")) < 0.179 : brand;
  const bg = custom || (brand ? "rgb(var(--c-primary-deeper))" : "#FFFFFF");
  const fg = validHex(s.headerText) || (custom ? readableOn(custom) : dark ? "#FFFFFF" : "#1F2937");
  const [r, g, b] = rgb(fg, dark ? "#ffffff" : "#1f2937");
  return {
    dark, style: {
      "--h-bg": bg, "--h-fg": fg, "--h-muted": `rgba(${r},${g},${b},.72)`,
      "--h-hover": dark ? "rgba(255,255,255,.12)" : "rgba(15,23,42,.06)",
      "--h-field": dark ? "rgba(255,255,255,.12)" : "#F1F3F7",
      "--h-line": dark ? "rgba(255,255,255,.14)" : "rgba(15,23,42,.08)",
    } as React.CSSProperties,
  };
}

export default function Header({ settings, categories }: { settings: StoreSettings; categories: Category[] }) {
  const router = useRouter();
  const path = usePathname();
  const home = path === "/";
  const t = useT(); const flags = useFlags();
  const [q, setQ] = useState("");
  const [mounted, setMounted] = useState(false);
  const count = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const wishCount = useWishlist((s) => s.items.length);
  useEffect(() => setMounted(true), []);

  const groceryCats = categories.filter((c) => c.kind !== "medicine");
  const { dark, style } = headerTone(settings);
  const on = (v: boolean | undefined, def = true) => (v === undefined ? def : v);
  const sticky = settings.headerSticky || "bar";
  const fieldRadius = settings.headerSearchStyle === "box" ? "rounded-lg" : "rounded-full";
  const submit = (e: React.FormEvent) => { e.preventDefault(); router.push(`/products?q=${encodeURIComponent(q)}`); };

  const navLink = "hidden whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition hover:bg-[var(--h-hover)]";
  const cartCls = settings.headerCartStyle === "primary"
    ? "bg-primary text-white hover:bg-primary-dark"
    : settings.headerCartStyle === "outline"
      ? "border-[1.5px] border-current hover:bg-[var(--h-hover)]"
      : "bg-accent text-white hover:bg-accent-dark";
  const medCls = settings.headerMedicineStyle === "solid"
    ? "bg-emerald-600 text-white hover:bg-emerald-700"
    : settings.headerMedicineStyle === "plain"
      ? "text-emerald-600 hover:bg-[var(--h-hover)]"
      : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100";

  const bar = (
    <header className={`${sticky === "bar" ? "sticky top-0 z-30" : "relative z-30"} border-b`} style={{ ...style, background: "var(--h-bg)", color: "var(--h-fg)", borderColor: "var(--h-line)" }}>
      <div className="page-w mx-auto flex items-center gap-2 px-3 py-2 sm:gap-5 sm:px-4 sm:py-2.5">
        <Link href="/" aria-label={`${settings.storeName} home`} className="shrink-0">
          <span className={`flex items-center ${dark ? "rounded-xl bg-white px-2 py-1" : ""}`}><Logo src={settings.logo} name={settings.storeName} priority className="h-8 w-auto sm:h-10" /></span>
        </Link>
        <form className="relative min-w-0 flex-1 sm:max-w-2xl" role="search" onSubmit={submit}>
          <input
            className={`h-10 w-full ${fieldRadius} border border-transparent py-2 pl-10 pr-4 text-sm outline-none transition placeholder:text-[color:var(--h-muted)] focus:border-primary/40 focus:bg-white focus:text-gray-900 focus:ring-4 focus:ring-primary/15 focus:placeholder:text-gray-400 sm:h-11 sm:pl-11`}
            style={{ background: "var(--h-field)", color: "var(--h-fg)" }}
            placeholder={t("header.search")} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products"
          />
          <Icon d={SEARCH} className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 opacity-70 sm:top-3.5" />
        </form>
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          {settings.showMedicine && (
            <Link href="/medicine" className={`mr-1 hidden items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition md:flex ${medCls} ${path.startsWith("/medicine") ? "ring-2 ring-emerald-500" : ""}`}>
              <Icon d={CROSS} className="h-4 w-4" />
              {t("header.medicine")}
            </Link>
          )}
          {on(settings.headerShowOrders) && <Link href="/orders" className={`${navLink} lg:block`} style={{ color: "var(--h-muted)" }}>{t("header.orders")}</Link>}
          {on(settings.headerShowTrack) && <Link href="/track" className={`${navLink} lg:block`} style={{ color: "var(--h-muted)" }}>{t("header.track")}</Link>}
          {on(settings.headerShowContact, false) && <Link href="/contact" className={`${navLink} xl:block`} style={{ color: "var(--h-muted)" }}>{t("header.contact")}</Link>}
          <NotificationBell />
          {flags.showWishlist && (
            <Link href="/wishlist" className="relative hidden h-10 w-10 items-center justify-center rounded-full transition hover:bg-[var(--h-hover)] sm:flex" aria-label="Wishlist">
              <Icon d={HEART} />
              {mounted && wishCount > 0 && <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[color:var(--h-bg)]">{wishCount}</span>}
            </Link>
          )}
          <Link href="/cart" aria-label="Cart" className={`relative ml-1 flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold transition sm:px-4 ${cartCls}`}>
            <Icon d={CART} className="h-5 w-5" />
            <span className="hidden sm:inline">{t("header.cart")}</span>
            {mounted && count > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-deeper px-1 text-[11px] font-bold leading-none text-white ring-2 ring-[color:var(--h-bg)]">{count}</span>}
          </Link>
        </div>
      </div>
    </header>
  );

  const strip = on(settings.headerShowCategories) && (
    <nav className={`border-b border-gray-200/70 bg-white text-gray-900 ${home ? "hidden md:block" : ""}`} aria-label="Categories">
      <div className="page-w mx-auto flex items-start gap-0.5 overflow-x-auto px-2 py-2 sm:gap-1.5 sm:px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <CategoryChip href="/products" name={t("header.all")} image={settings.navAllImage || undefined} iconBg="#EEF2FF" active={path === "/products"} />
        {settings.showMedicine && <CategoryChip href="/medicine" name={t("header.medicine")} image={settings.navMedicineImage || undefined} iconBg="#ECFDF5" active={path.startsWith("/medicine")} />}
        {groceryCats.map((c) => <CategoryChip key={c.id} href={`/products?cat=${c.id}`} name={c.name} image={c.image} iconBg={c.iconBg} />)}
        <CategoryChip href="/products?sale=1" name={t("header.offers")} image={settings.navOffersImage || undefined} iconBg="#FFF7ED" />
      </div>
    </nav>
  );

  return (
    <>
      <AnnouncementBar settings={settings} />
      {sticky === "all" ? <div className="sticky top-0 z-30">{bar}{strip}</div> : <>{bar}{strip}</>}
    </>
  );
}
