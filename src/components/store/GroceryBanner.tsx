import Link from "next/link";

type Props = {
  storeName: string;
  title: string;
  subtitle?: string;
  /** Secondary link label (admin "Button text"); hidden on small screens. */
  browseLabel?: string;
  /** "slide" = inside HeroSlider (re-animates when active); "page" = standalone hero with a rise-in on load. */
  mode?: "slide" | "page";
};

const PRODUCE = [
  { e: "🥕", cls: "right-[44%] top-[14%] h-9 w-9 text-lg sm:right-[40%] sm:top-[12%] sm:h-14 sm:w-14 sm:text-3xl", d: "0ms", r: "-8deg" },
  { e: "🍎", cls: "right-[6%] top-[10%] h-11 w-11 text-2xl sm:right-[8%] sm:top-[14%] sm:h-20 sm:w-20 sm:text-5xl", d: "400ms", r: "6deg" },
  { e: "🥛", cls: "right-[26%] bottom-[10%] h-10 w-10 text-xl sm:right-[24%] sm:bottom-[12%] sm:h-16 sm:w-16 sm:text-4xl", d: "900ms", r: "-4deg" },
  { e: "🥬", cls: "right-[4%] bottom-[8%] hidden h-14 w-14 text-3xl sm:flex sm:right-[6%] sm:h-[4.5rem] sm:w-[4.5rem] sm:text-4xl", d: "1300ms", r: "8deg" },
  { e: "🥖", cls: "right-[46%] bottom-[8%] hidden h-12 w-12 text-2xl md:flex md:h-16 md:w-16 md:text-4xl", d: "1700ms", r: "-10deg" },
] as const;

/** Grocery-themed hero: brand gradient, drifting glows and floating produce. CSS-only motion (no JS, no images). */
export default function GroceryBanner({ storeName, title, subtitle, browseLabel, mode = "page" }: Props) {
  const enter = mode === "slide" ? "slide-in" : "anim-rise";
  const body = (
    <div className="relative aspect-[21/9] max-h-[140px] w-full overflow-hidden bg-gradient-to-br from-primary-deeper via-primary to-primary-dark text-white sm:aspect-[16/5] sm:max-h-none">
      <div aria-hidden className="hero-blob pointer-events-none absolute -left-10 -top-16 h-48 w-48 rounded-full bg-accent/30 blur-3xl sm:h-72 sm:w-72" />
      <div aria-hidden className="hero-blob pointer-events-none absolute -bottom-20 right-1/4 h-52 w-52 rounded-full bg-white/10 blur-3xl [animation-delay:-4s] sm:h-80 sm:w-80" />
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 hidden h-72 w-72 rounded-full border border-white/10 sm:block" />
      {PRODUCE.map((x) => (
        <span key={x.e} aria-hidden className={`hero-float pointer-events-none absolute flex items-center justify-center rounded-full bg-white/15 shadow-lg ring-1 ring-white/25 backdrop-blur-sm ${x.cls}`} style={{ "--d": x.d, "--r": x.r } as React.CSSProperties}>{x.e}</span>
      ))}
      <div className="relative z-10 flex h-full items-center px-5 sm:px-12">
        <div className="max-w-[62%] sm:max-w-lg">
          <p className={`${enter} text-[10px] font-semibold uppercase tracking-widest text-white/80 sm:text-xs`} style={{ "--d": "0ms" } as React.CSSProperties}>{storeName}</p>
          <h2 className={`${enter} mt-0.5 line-clamp-2 whitespace-pre-line text-base font-extrabold leading-tight sm:mt-2 sm:text-4xl`} style={{ "--d": "80ms" } as React.CSSProperties}>{title}</h2>
          {subtitle && <p className={`${enter} mt-2 hidden line-clamp-2 text-white/85 sm:block sm:text-base`} style={{ "--d": "160ms" } as React.CSSProperties}>{subtitle}</p>}
          <div className={`${enter} mt-2 flex items-center gap-3 sm:mt-5`} style={{ "--d": "240ms" } as React.CSSProperties}>
            <Link href="/products?sale=1" className="btn-accent group/cta rounded-full px-4 py-1.5 text-xs shadow-lg shadow-black/20 sm:px-7 sm:py-3 sm:text-base" tabIndex={mode === "slide" ? undefined : 0}>
              Shop Deals
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 transition-transform motion-safe:group-hover/cta:translate-x-0.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
            {browseLabel && <Link href="/products" className="hidden text-sm font-semibold text-white/90 underline-offset-4 hover:underline sm:inline">{browseLabel}</Link>}
          </div>
        </div>
      </div>
    </div>
  );
  if (mode === "slide") return body;
  return <section className="relative -mx-4 overflow-hidden shadow-card sm:mx-0 sm:rounded-2xl" aria-label={storeName}>{body}</section>;
}
