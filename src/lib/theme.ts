import type { StoreSettings } from "./types";

/** Brand colours (from the DaffoMart logo). Used whenever the admin has not chosen another colour. */
export const BRAND = { primary: "#1E3A8A", accent: "#F7941D" };
const LEGACY = new Set(["#e11d48", "#f59e0b", "#0f172a"]); // old seed defaults (rose/amber/slate) that never matched the logo

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;
export function rgb(hex: string | undefined, fallback: string): [number, number, number] {
  let h = (hex ?? "").trim();
  if (!HEX.test(h) || LEGACY.has(h.toLowerCase())) h = fallback;
  h = h.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const tri = (c: number[]) => c.join(" ");
export const validHex = (v?: string) => (v && HEX.test(v.trim()) && !LEGACY.has(v.trim().toLowerCase()) ? v.trim() : "");

const RADIUS: Record<string, string> = { none: "0px", sm: "6px", md: "10px", lg: "14px", full: "9999px" };
const PAD: Record<string, [string, string, string]> = { sm: ["0.35rem", "0.8rem", "0.8rem"], md: ["0.5rem", "1rem", "0.875rem"], lg: ["0.7rem", "1.4rem", "1rem"] };

/** CSS variables for the storefront wrapper: colours, button shape/size/colour. Tailwind classes read these. */
export function themeVars(s: Partial<StoreSettings>): Record<string, string> {
  const p = rgb(s.primaryColor, BRAND.primary), a = rgb(s.accentColor, BRAND.accent);
  const white = [255, 255, 255], black = [0, 0, 0];
  const sec = validHex(s.secondaryColor) ? rgb(s.secondaryColor, BRAND.primary) : mix(p, black, 0.55);
  const btn = rgb(s.buttonColor || s.primaryColor, BRAND.primary);
  const [py, px, fs] = PAD[s.buttonSize || "md"] ?? PAD.md;
  return {
    "--c-primary": tri(p), "--c-primary-dark": tri(mix(p, black, 0.22)), "--c-primary-deeper": tri(mix(p, black, 0.55)),
    "--c-primary-light": tri(mix(p, white, 0.82)), "--c-primary-soft": tri(mix(p, white, 0.93)),
    "--c-accent": tri(a), "--c-accent-dark": tri(mix(a, black, 0.15)), "--c-accent-soft": tri(mix(a, white, 0.9)),
    "--c-secondary": tri(sec),
    "--c-btn": tri(btn), "--c-btn-dark": tri(mix(btn, black, 0.18)), "--c-btn-text": tri(rgb(s.buttonTextColor, "#ffffff")),
    "--btn-radius": RADIUS[s.buttonRadius || "lg"] ?? RADIUS.lg, "--btn-py": py, "--btn-px": px, "--btn-fs": fs,
  };
}
