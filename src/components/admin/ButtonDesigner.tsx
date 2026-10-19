"use client";
import { Field } from "@/components/admin/ui";
import { btnLookProps } from "@/lib/btnLook";
import { validHex } from "@/lib/theme";
import type { BtnLook } from "@/lib/types";

const Pick = ({ label, value, onChange, opts }: { label: string; value?: string; onChange: (v: string) => void; opts: [string, string][] }) => (
  <Field label={label}><select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)}><option value="">Default</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
);

/**
 * Full designer for one button: colour, text colour, size, boldness, shape, animation, shadow, style, CAPITALS.
 * Everything empty = the website's built-in look. `preset` is only used for the live preview (what the button looks like with no changes).
 */
export default function ButtonDesigner({ title, value, onChange, preset, sample = "Button", themeStyle }: {
  title: string; value?: BtnLook; onChange: (v: BtnLook | undefined) => void; preset: BtnLook & { bg?: string; color?: string }; sample?: string; themeStyle?: React.CSSProperties;
}) {
  const v: BtnLook = value ?? {};
  const set = (patch: Partial<BtnLook>) => {
    const next: Record<string, unknown> = { ...v, ...patch };
    for (const k of Object.keys(next)) if (next[k] === "" || next[k] === undefined || next[k] === false) delete next[k];
    onChange(Object.keys(next).length ? (next as BtnLook) : undefined);
  };
  const p = btnLookProps(value, preset);
  const colour = (label: string, k: "bg" | "color", fallback: string, hint: string) => (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <input type="color" className="h-10 w-12 cursor-pointer rounded border bg-white p-1" value={validHex(v[k]) || fallback} onChange={(e) => set({ [k]: e.target.value })} aria-label={label} />
        <input className="input font-mono" value={v[k] ?? ""} placeholder="default" maxLength={7} onChange={(e) => set({ [k]: e.target.value.trim() })} />
        {v[k] ? <button type="button" className="btn-ghost btn-sm" onClick={() => set({ [k]: "" })}>Reset</button> : null}
      </div>
    </Field>
  );
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {value ? <button type="button" className="btn-outline btn-sm" onClick={() => onChange(undefined)}>Reset all to default</button> : <span className="text-xs text-gray-400">Default look</span>}
      </div>
      <div style={themeStyle} className="flex min-h-[64px] items-center justify-center rounded-lg bg-gray-100 p-3">
        <span className={p.className} style={p.style}>{sample}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {colour("Button colour", "bg", "#1E3A8A", "Empty = default colour")}
        {colour("Text colour", "color", "#FFFFFF", "Empty = automatic (readable)")}
        <Pick label="Style" value={v.style} onChange={(x) => set({ style: x as BtnLook["style"] })} opts={[["solid", "Solid (filled)"], ["soft", "Soft tint"], ["outline", "Outline"], ["plain", "Text only"]]} />
        <Pick label="Size" value={v.size} onChange={(x) => set({ size: x as BtnLook["size"] })} opts={[["sm", "Small"], ["md", "Medium"], ["lg", "Large"]]} />
        <Pick label="Text boldness" value={v.weight} onChange={(x) => set({ weight: x as BtnLook["weight"] })} opts={[["medium", "Normal"], ["semibold", "Semi-bold"], ["bold", "Bold"], ["black", "Extra bold"]]} />
        <Pick label="Shape" value={v.radius} onChange={(x) => set({ radius: x as BtnLook["radius"] })} opts={[["none", "Square"], ["md", "Slightly rounded"], ["lg", "Rounded"], ["full", "Pill"]]} />
        <Pick label="Animation" value={v.anim} onChange={(x) => set({ anim: x as BtnLook["anim"] })} opts={[["none", "None"], ["lift", "Lift on hover"], ["pulse", "Pulse"], ["shine", "Shine sweep"], ["bounce", "Bounce"], ["glow", "Glow ring"]]} />
        <Pick label="Shadow" value={v.shadow} onChange={(x) => set({ shadow: x as BtnLook["shadow"] })} opts={[["none", "None"], ["soft", "Soft"], ["strong", "Strong"]]} />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={!!v.uppercase} onChange={(e) => set({ uppercase: e.target.checked })} /> CAPITAL LETTERS</label>
    </div>
  );
}
