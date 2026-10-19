import Link from "next/link";
import Logo from "./Logo";
import type { Category, StoreSettings } from "@/lib/types";
import { paymentOptions } from "@/server/payments";
import { makeT } from "@/lib/texts";
import { validHex } from "@/lib/theme";

const PROMO_H: Record<string, string> = { sm: "h-20 sm:h-24", md: "h-28 sm:h-36", lg: "h-36 sm:h-48" };

export default async function Footer({ settings: s, categories }: { settings: StoreSettings; categories: Category[] }) {
  const t = makeT(s.texts);
  const hiring = (s.positions ?? []).some((p) => p.active && p.title.trim());
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
        <div className="mx-auto page-w w-full px-4 pt-8">
          <div className={`overflow-hidden rounded-2xl ${PROMO_H[s.footerPromoHeight || "md"] ?? PROMO_H.md}`} style={promoBg ? { background: promoBg } : { background: "rgba(255,255,255,0.06)" }}>
            {s.footerPromoLink ? <a href={s.footerPromoLink} className="block h-full" {...(/^https?:/.test(s.footerPromoLink) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{promoImg}</a> : promoImg}
          </div>
        </div>
      )}
      <div className="mx-auto grid page-w w-full gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="inline-block rounded-xl bg-white px-3 py-2">
            <Logo src={s.logo} name={s.storeName} className="h-9 w-auto" />
          </div>
          <p className="mt-4 max-w-xs text-sm text-white/70">{s.footerText || s.tagline}</p>
          {s.courierOutsideNote && <p className="mt-3 max-w-xs text-xs leading-relaxed text-white/55">{s.courierOutsideNote}</p>}
        </div>
        <div className="text-sm">
          <h4 className="mb-3 font-semibold">{t("footer.shop")}</h4>
          <ul className="space-y-2 text-white/70">
            <li><Link className="hover:text-white" href="/products">{t("footer.all")}</Link></li>
            {s.showMedicine && <li><Link className="font-semibold text-emerald-300 hover:text-white" href="/medicine">💊 {t("header.medicine")}</Link></li>}
            {s.footerShowCategories !== false && categories.filter((c) => c.kind !== "medicine").map((c) => (
              <li key={c.id}><Link className="hover:text-white" href={`/products?cat=${c.id}`}>{c.name}</Link></li>
            ))}
          </ul>
        </div>
        <div className="text-sm">
          <h4 className="mb-3 font-semibold">{t("footer.help")}</h4>
          <ul className="space-y-2 text-white/70">
            <li><Link className="hover:text-white" href="/track">{t("footer.track")}</Link></li>
            <li><Link className="hover:text-white" href="/contact">{t("footer.contactInfo")}</Link></li>
            <li><Link className="hover:text-white" href="/policy">{t("footer.policy")}</Link></li>
            {hiring && <li><Link className="hover:text-white" href="/join">{s.joinTitle || "Join our team"}</Link></li>}
            <li><Link className="hover:text-white" href="/cart">{t("footer.cart")}</Link></li>
            <li><Link className="hover:text-white" href="/checkout">{t("footer.checkout")}</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <h4 className="mb-3 font-semibold">{t("footer.contact")}</h4>
          <ul className="space-y-2 text-white/70">
            {s.address && <li>{s.address}</li>}
            {s.hours && <li>🕒 {s.hours}</li>}
            {s.phone && <li><a className="hover:text-white" href={`tel:${s.phone.replace(/\s/g, "")}`}>{s.phone}</a></li>}
            {s.email && <li><a className="hover:text-white" href={`mailto:${s.email}`}>{s.email}</a></li>}
            {s.facebook && <li><a className="hover:text-white" href={s.facebook} target="_blank" rel="noopener noreferrer">Facebook</a></li>}
          </ul>
          {payments.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Payment methods">
              {payments.map((p) => p.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <span key={p.id} className="flex h-7 items-center rounded-md bg-white px-2"><img src={p.logo} alt={p.label} className="h-5 w-auto max-w-[64px] object-contain" loading="lazy" /></span>
              ) : (
                <span key={p.id} className="rounded-full px-2.5 py-1 text-[11px] text-white/90" style={{ background: validHex(p.color) || "rgba(255,255,255,0.12)" }}>{p.label}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {s.storeName}. {t("footer.rights")}
      </div>
    </footer>
  );
}
