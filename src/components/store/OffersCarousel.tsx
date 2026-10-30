import Ticker from "./Ticker";
import ProductCard from "./ProductCard";
import { TICKER_SECONDS_PER_ITEM } from "@/lib/storeTheme";
import { dealInfo, dealKindForProduct } from "@/lib/deals";
import { discountPct } from "@/lib/format";
import { offerEndsText } from "@/lib/offers";
import type { DealBadgeSettings } from "@/lib/types";
import type { Product } from "@/lib/types";

/** Dedicated offers strip: ONLY active offer products (real price, real old price, real stock, working Add to cart / Buy now through ProductCard). */
export default function OffersCarousel({ products, whatsapp, dealCfg, speed = "normal", label, now }: { products: Product[]; whatsapp?: string; dealCfg: DealBadgeSettings; speed?: "slow" | "normal" | "fast"; label: string; now: number }) {
  if (!products.length) return null;
  const card = (p: Product, k: string) => {
    const kind = dealKindForProduct(p, discountPct(p.price, p.oldPrice), dealCfg); const ends = offerEndsText(p, now);
    return (
      <div key={k} className="mr-3 w-[44vw] max-w-[190px] shrink-0 sm:w-[190px]">
        <ProductCard p={p} whatsapp={whatsapp} deal={kind ? dealInfo(kind, dealCfg) : null} />
        {ends && <p className="mt-1 text-center text-[11px] font-semibold text-red-600">⏱ {ends}</p>}
      </div>);
  };
  // Each offer is rendered once. The strip moves right → left only when it is wider than the screen (Ticker measures this); otherwise it is shown still.
  return <Ticker direction="rtl" label={label} seconds={Math.max(10, products.length * TICKER_SECONDS_PER_ITEM[speed] * 1.6)}>{products.map((p) => card(p, p.id))}</Ticker>;
}
