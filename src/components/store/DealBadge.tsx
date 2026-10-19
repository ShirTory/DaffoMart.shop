import type { DealInfo, DealKind } from "@/lib/deals";

const ICON: Record<DealKind, string> = {
  hot: "M12 2c1 3.5 4 5 4 9a4 4 0 0 1-8 0c0-1.2.4-2 1-3-.2 1.6.6 2.4 1.5 2.4C11 8 10.5 5 12 2zM7 15a5 5 0 0 0 10 0",
  value: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.3 6.8 19.1l1-5.8L3.5 9.2l5.9-.9L12 3z",
  mega: "M19 5L5 19M7 7.5a1.5 1.5 0 1 0 0-.01zM17 17.5a1.5 1.5 0 1 0 0-.01z",
  limited: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-12v4l2.5 1.5M9 2h6",
  exclusive: "M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8z",
};
export const DEAL_GRADIENT: Record<DealKind, string> = {
  hot: "from-red-600 to-orange-500",
  value: "from-emerald-600 to-teal-500",
  mega: "from-fuchsia-600 to-purple-600",
  limited: "from-amber-500 to-rose-500",
  exclusive: "from-indigo-600 to-sky-500",
};

/** Small iconic pill for deals. Pure markup (works in server and client components); the shine is CSS-only. */
export default function DealBadge({ deal, className = "", delay = 0, text }: { deal: DealInfo; className?: string; delay?: number; text?: string }) {
  const { kind, label, color } = deal;
  const style: Record<string, string> = {};
  if (delay) style["--d"] = `${delay}ms`;
  if (color) style.backgroundImage = `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 70%, #fff))`;
  return (
    <span
      className={`deal-badge inline-flex max-w-full items-center gap-1 rounded-full bg-gradient-to-r px-2 py-0.5 text-[10px] font-extrabold uppercase leading-4 tracking-wide text-white shadow-sm ring-1 ring-white/30 ${DEAL_GRADIENT[kind]} ${className}`}
      style={style as React.CSSProperties}
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill={kind === "value" || kind === "exclusive" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={ICON[kind]} />
      </svg>
      <span className="truncate">{text || label}</span>
    </span>
  );
}
