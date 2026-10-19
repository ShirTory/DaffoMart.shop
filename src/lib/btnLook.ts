import type { CSSProperties } from "react";
import type { BtnLook } from "./types";
import { readableOn, validHex } from "./theme";

/**
 * One shared "button designer" for the storefront. Every customisable button (header cart / medicine / links, the home medicine button)
 * stores a small BtnLook object from Admin → Appearance. Empty fields fall back to the preset the caller passes in, so nothing changes
 * until the admin picks something.
 */
const SIZE = { sm: "h-8 px-3 text-xs gap-1.5", md: "h-10 px-3.5 text-sm gap-2", lg: "h-12 px-5 text-base gap-2.5" } as const;
const WEIGHT = { medium: "font-medium", semibold: "font-semibold", bold: "font-bold", black: "font-black" } as const;
const RADIUS = { none: "rounded-none", md: "rounded-lg", lg: "rounded-xl", full: "rounded-full" } as const;
const SHADOW = { none: "", soft: "shadow-sm", strong: "shadow-lg" } as const;
const ANIM = { none: "", lift: "bx-lift", pulse: "bx-pulse", shine: "bx-shine", bounce: "bx-bounce", glow: "bx-glow" } as const;

export const BTN_DEFAULT: Required<Pick<BtnLook, "style" | "size" | "weight" | "radius" | "anim" | "shadow">> = { style: "solid", size: "md", weight: "semibold", radius: "full", anim: "none", shadow: "none" };

export function btnLookProps(look: BtnLook | undefined, preset: BtnLook & { bg?: string; color?: string } = {}): { className: string; style: CSSProperties } {
  const m = { ...BTN_DEFAULT, ...preset, ...Object.fromEntries(Object.entries(look ?? {}).filter(([, v]) => v !== undefined && v !== "")) } as BtnLook & typeof BTN_DEFAULT;
  const custom = validHex(look?.bg);
  const bg = custom || preset.bg || "rgb(var(--c-primary))";
  const textPick = validHex(look?.color);
  const solidFg = textPick || (custom ? readableOn(custom) : preset.color || "#FFFFFF");
  const tint = textPick || bg;
  let style: CSSProperties;
  if (m.style === "solid") style = { background: bg, color: solidFg, borderColor: bg };
  else if (m.style === "soft") style = { background: `color-mix(in srgb, ${bg} 14%, transparent)`, color: tint, borderColor: "transparent" };
  else if (m.style === "outline") style = { background: "transparent", color: tint, borderColor: bg };
  else style = { background: "transparent", color: tint, borderColor: "transparent" };
  (style as Record<string, string>)["--bx-glow"] = `color-mix(in srgb, ${bg} 55%, transparent)`;
  const className = ["bx inline-flex items-center justify-center whitespace-nowrap border-[1.5px] transition", SIZE[m.size] ?? SIZE.md, WEIGHT[m.weight] ?? WEIGHT.semibold, RADIUS[m.radius] ?? RADIUS.full, SHADOW[m.shadow] ?? "", ANIM[m.anim] ?? "", m.uppercase ? "uppercase tracking-wide" : ""].filter(Boolean).join(" ");
  return { className, style };
}
