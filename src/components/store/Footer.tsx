import Logo from "./Logo";
import type { Category, StoreSettings } from "@/lib/types";
import { paymentOptions } from "@/server/payments";
import { makeT } from "@/lib/texts";
import { validHex } from "@/lib/theme";
import BrandIcon, { ICON_LABEL } from "./BrandIcon";

// Compact marketing poster: slim on every screen so the footer stays short.
const PROMO_H: Record<string, string> = { sm: "h-14 sm:h-20", md: "h-20 sm:h-28", lg: "h-28 sm:h-36" };

/** Footer = marketing poster + shop information + contact + payment method icons. Nothing else. */
export default async function Footer({ settings: s }: { settings: StoreSettings; categories?: Category[] }) {
  const t = makeT(s.texts);
  // only methods that really work right now (a gateway that is not connected yet is not shown as a way to pay)
  const payments = s.footerShowPayments === false ? [] : (await paymentOptions(s)).filter((p) => !p.disabled);
  const wa = (s.whatsapp || "").replace(/\D/g, "");
  const socials = (["facebook", "instagram", "youtube", "tiktok"] as const).map((k) => [k, (s[k] || "").trim()] as const).filter(([, v]) => /^https?:\/\//i.test(v));
  const promo = s.footerPromoShow !== false && s.footerPromoImage ? s.footerPromoImage : "";
  const promoBg = validHex(s.footerPromoBg);
  const promoImg = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={promo} alt={s.footerPromoAlt || s.storeName} loading="lazy" decoding="async" className={`w-full ${s.footerPromoFit === "contain" ? "object-contain" : "object-cover"}`} style={{ height: "100%" }} />
  );

  return (
    <footer className="mt-6 bg-secondary text-white">
      {promo && (
        <div className="mx-auto page-w w-full px-4 pt-6">
          <div className={`overflow-hidden rounded-xl ${PROMO_H[s.footerPromoHeight || "sm"] ?? PROMO_H.sm}`} style={promoBg ? { background: promoBg } : { background: "rgba(255,255,255,0.06)" }}>
            {s.footerPromoLink ? <a href={s.footerPromoLink} className="block h-full" {...(/^https?:/.test(s.footerPromoLink) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{promoImg}</a> : promoImg}
          </div>
        </div>
      )}
      <div className="mx-auto grid page-w w-full gap-6 px-4 py-8 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="inline-block rounded-xl bg-white px-3 py-2">
            <Logo src={s.logo} name={s.storeName} className="h-9 w-auto" />
          </div>
          <p className="mt-3 max-w-xs text-white/70">{s.footerText || s.tagline}</p>
          {s.hours && <p className="mt-2 text-white/70">🕒 {s.hours}</p>}
        </div>
        <div>
          <h4 className="mb-3 font-semibold">{t("footer.contact")}</h4>
          <ul className="space-y-2 text-white/70">
            {s.address && <li className="flex items-start gap-2"><BrandIcon k="address" settings={s} size="h-7 w-7" /><span className="pt-1">{s.address}</span></li>}
            {s.phone && <li><a className="flex items-center gap-2 hover:text-white" href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}><BrandIcon k="phone" settings={s} size="h-7 w-7" /><span>{s.phone}</span></a></li>}
            {wa.length >= 8 && <li><a className="flex items-center gap-2 hover:text-white" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"><BrandIcon k="whatsapp" settings={s} size="h-7 w-7" /><span>WhatsApp</span></a></li>}
            {s.email && <li><a className="flex items-center gap-2 hover:text-white" href={`mailto:${s.email}`}><BrandIcon k="email" settings={s} size="h-7 w-7" /><span className="break-all">{s.email}</span></a></li>}
          </ul>
          {socials.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Social media">
              {socials.map(([k, href]) => <a key={k} href={href} target="_blank" rel="noopener noreferrer" aria-label={ICON_LABEL[k]} className="transition hover:scale-105 active:scale-95"><BrandIcon k={k} settings={s} size="h-10 w-10" /></a>)}
            </div>
          )}
        </div>
        {payments.length > 0 && (
          <div>
            <h4 className="mb-3 font-semibold">Payment methods</h4>
            <div className="flex flex-wrap gap-2" aria-label="Payment methods">
              {payments.map((p) => {
                const img = p.logo || s.iconImages?.[p.id];
                return img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <span key={p.id} title={p.label} className="flex h-10 items-center rounded-lg bg-white px-2.5"><img src={img} alt={p.label} className="h-7 w-auto max-w-[80px] object-contain" loading="lazy" /></span>
                ) : (
                  <span key={p.id} title={p.label} className="flex h-10 items-center gap-1.5 rounded-lg bg-white pl-1 pr-2.5 text-xs font-bold text-gray-800"><BrandIcon k={p.id} settings={s} size="h-8 w-8" label={p.label} />{p.label}</span>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-white/10 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pt-3 text-center text-xs text-white/50 md:pb-3">© {new Date().getFullYear()} {s.storeName}</div>
    </footer>
  );
}
