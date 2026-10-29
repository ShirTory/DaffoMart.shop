import Link from "next/link";
import Ticker from "./Ticker";
import { validHex } from "@/lib/theme";
import { TICKER_SECONDS_PER_ITEM } from "@/lib/storeTheme";
import type { Category, StoreSettings } from "@/lib/types";

const ICON: Record<string, string> = { sm: "h-14 w-14 sm:h-16 sm:w-16", md: "h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]", lg: "h-20 w-20 sm:h-24 sm:w-24" };
const ITEM_W: Record<string, string> = { sm: "w-[64px] sm:w-[76px]", md: "w-[72px] sm:w-[84px]", lg: "w-[88px] sm:w-[104px]" };

/** Categories as an automatically moving strip. Every category stays visible (the strip loops); visitors never have to swipe. */
export default function CategoryTicker({ categories, settings, style = "circle", moving = true, speed = "normal", label }: { categories: Category[]; settings: Partial<StoreSettings>; style?: "circle" | "square" | "pill"; moving?: boolean; speed?: "slow" | "normal" | "fast"; label: string }) {
  const size = settings.catIconSize || "sm"; const showLabels = settings.catShowLabels !== false;
  const tile = (c: Category) => {
    const bg = validHex(c.iconBg) || validHex(settings.catIconBg);
    const img = c.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.image} alt="" className={`h-full w-full ${settings.catIconFit === "contain" ? "object-contain p-1.5" : "object-cover"}`} loading="lazy" decoding="async" /> : <span className="text-base font-bold text-gray-600 sm:text-lg">{(c.name || "?").charAt(0).toUpperCase()}</span>;
    if (style === "pill") return (
      <Link key={c.id} href={`/products?cat=${c.id}`} className="group flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-4 shadow-sm hover:border-primary">
        <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-50" style={bg ? { background: bg } : undefined}>{img}</span>
        <span className="whitespace-nowrap text-xs font-semibold text-gray-800 group-hover:text-primary sm:text-sm">{c.name}</span>
      </Link>);
    return (
      <Link key={c.id} href={`/products?cat=${c.id}`} className={`group cat-link flex shrink-0 flex-col items-center ${ITEM_W[size] ?? ITEM_W.sm}`}>
        <div className={`cat-float flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-gray-100 group-hover:ring-primary ${ICON[size] ?? ICON.sm} ${style === "square" ? "rounded-xl" : "rounded-full"} ${bg ? "" : "bg-gradient-to-b from-gray-50 to-white"}`} style={bg ? { background: bg } : undefined}>{img}</div>
        {showLabels && <p className="mt-1 line-clamp-2 text-center text-[10px] font-semibold leading-tight group-hover:text-primary sm:text-xs" style={{ color: validHex(settings.catLabelColor) || "#1f2937" }}>{c.name}</p>}
      </Link>);
  };
  const gap = style === "pill" ? "mr-2" : "mr-3";
  if (!moving) return <div className="flex flex-wrap justify-center gap-x-3 gap-y-3 sm:justify-start">{categories.map(tile)}</div>;
  // Repeat short lists so one copy is always wider than the screen (a seamless loop needs that).
  const repeat = Math.max(1, Math.ceil((style === "pill" ? 10 : 18) / Math.max(1, categories.length)));
  const set = Array.from({ length: repeat }, (_, r) => categories.map((c) => <div key={`${c.id}-${r}`} className={`${gap} flex`}>{tile(c)}</div>));
  return <Ticker label={label} seconds={categories.length * repeat * TICKER_SECONDS_PER_ITEM[speed]}>{set}</Ticker>;
}
