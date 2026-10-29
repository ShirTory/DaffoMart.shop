import Logo from "./Logo";
import type { Category, StoreSettings } from "@/lib/types";
import { paymentOptions } from "@/server/payments";
import { makeT } from "@/lib/texts";
import { validHex } from "@/lib/theme";

// Compact marketing poster: slim on every screen so the footer stays short.
const PROMO_H: Record<string, string> = { sm: "h-14 sm:h-20", md: "h-20 sm:h-28", lg: "h-28 sm:h-36" };

/** Footer = marketing poster + shop information + contact + payment method icons. Nothing else. */
export default async function Footer({ settings: s }: { settings: StoreSettings; categories?: Category[] }) {
  const t = makeT(s.texts);
  // only methods that really work right now (a gateway that is not connected yet is not shown as a way to pay)
  const payments = s.footerShowPayments === false ? [] : (await paymentOptions(s)).filter((p) => !p.disabled);
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
            {s.address && <li>📍 {s.address}</li>}
            {s.phone && <li><a className="hover:text-white" href={`tel:${s.phone.replace(/\s/g, "")}`}>📞 {s.phone}</a></li>}
            {s.email && <li><a className="hover:text-white" href={`mailto:${s.email}`}>✉️ {s.email}</a></li>}
            {s.facebook && <li><a className="hover:text-white" href={s.facebook} target="_blank" rel="noopener noreferrer">Facebook</a></li>}
          </ul>
        </div>
        {payments.length > 0 && (
          <div>
            <h4 className="mb-3 font-semibold">Payment methods</h4>
            <div className="flex flex-wrap gap-2" aria-label="Payment methods">
              {payments.map((p) => p.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <span key={p.id} className="flex h-9 items-center rounded-md bg-white px-2.5"><img src={p.logo} alt={p.label} className="h-6 w-auto max-w-[72px] object-contain" loading="lazy" /></span>
              ) : (
                <span key={p.id} className="rounded-md px-3 py-1.5 text-xs font-semibold text-white" style={{ background: validHex(p.color) || "rgba(255,255,255,0.14)" }}>{p.label}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-white/10 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pt-3 text-center text-xs text-white/50 md:pb-3">© {new Date().getFullYear()} {s.storeName}</div>
    </footer>
  );
}
