/** Professional highlight icons — no emoji. Keys: truck, leaf, cash, tag, check, support, clock, star, shield, cart */

const PATHS: Record<string, string> = {
  truck:
    "M3 7h11v8H3V7zm11 2h3l3 3v3h-6V9zM6 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  leaf:
    "M12 3c4 2 7 6 7 10a7 7 0 0 1-7 7 7 7 0 0 1-7-7c0-4 3-8 7-10zm0 4v10",
  cash:
    "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9h1.5M16.5 15H18",
  tag:
    "M3 12l9-9h6l3 3v6l-9 9-9-9zm11-5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  check:
    "M5 13l4 4L19 7",
  support:
    "M12 3a7 7 0 0 0-7 7v3a2 2 0 0 0 2 2h1v-5H6a6 6 0 1 1 12 0h-2v5h1a2 2 0 0 0 2-2v-3a7 7 0 0 0-7-7zm-3 14h6a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z",
  clock:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-13v4l3 2",
  star:
    "M12 3l2.5 6.5L21 10l-5 4.2L17.5 21 12 17.3 6.5 21 8 14.2 3 10l6.5-.5L12 3z",
  shield:
    "M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z",
  cart:
    "M3 4h2l2.5 11h10l2-7H8M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
};

/** Map old emoji defaults → keys */
const EMOJI_MAP: Record<string, string> = {
  "🚚": "truck", "⚡": "truck", "🌿": "leaf", "✅": "check",
  "💵": "cash", "💰": "cash", "🏷️": "tag", "🔥": "tag",
  "💬": "support", "⭐": "star", "🛡️": "shield", "🛒": "cart",
  "🕐": "clock", "⏰": "clock",
};

export const FEATURE_ICON_KEYS = [
  ["truck", "Delivery / truck"],
  ["leaf", "Fresh / leaf"],
  ["cash", "Cash / payment"],
  ["tag", "Price / tag"],
  ["check", "Quality / check"],
  ["support", "Support"],
  ["clock", "Fast / clock"],
  ["star", "Star"],
  ["shield", "Trust / shield"],
  ["cart", "Cart"],
] as const;

export function resolveFeatureIconKey(icon?: string): string {
  if (!icon) return "check";
  if (PATHS[icon]) return icon;
  if (EMOJI_MAP[icon]) return EMOJI_MAP[icon];
  return "check";
}

export default function FeatureIcon({
  icon,
  image,
  className = "h-10 w-10",
}: {
  icon?: string;
  image?: string;
  className?: string;
}) {
  if (image) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft ring-1 ring-primary/10 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  const key = resolveFeatureIconKey(icon);
  const d = PATHS[key] || PATHS.check;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary ring-1 ring-primary/10 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </span>
  );
}
