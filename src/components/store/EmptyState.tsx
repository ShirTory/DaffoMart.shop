import Link from "next/link";
import type { StoreSettings } from "@/lib/types";
import { makeT } from "@/lib/texts";
import { validHex } from "@/lib/theme";

export type EmptyKind = "none" | "search" | "category";

/**
 * Shown instead of a blank space when there is nothing to list. Wording, icon/image, colours and alignment are admin settings
 * (Admin → Website Text for the messages, Admin → Appearance for the look).
 */
export default function EmptyState({ kind, settings: s, actionHref = "/products", actionLabel }: { kind: EmptyKind; settings: StoreSettings; actionHref?: string; actionLabel?: string }) {
  const t = makeT(s.texts);
  const legacyTitle = kind === "search" ? s.emptyStateTitle : "", legacyText = kind === "search" ? s.emptyStateText : "";
  const custom = (k: string) => (s.texts?.[k] ?? "").trim();
  const title = custom(`empty.${kind}.title`) || legacyTitle || t(`empty.${kind}.title`);
  const text = custom(`empty.${kind}.text`) || legacyText || t(`empty.${kind}.text`);
  const left = s.emptyStateAlign === "left";
  const bg = validHex(s.emptyStateBg), fg = validHex(s.emptyStateColor);
  return (
    <div className={`rounded-2xl border p-8 shadow-sm sm:p-12 ${left ? "text-left" : "text-center"} ${bg ? "" : "bg-white"}`} style={{ ...(bg ? { background: bg } : {}), ...(fg ? { color: fg } : {}) }} role="status">
      <div className={`mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-3xl ${left ? "" : "mx-auto"}`}>
        {s.emptyStateImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.emptyStateImage} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (s.emptyStateIcon || (kind === "none" ? "🛒" : "🔍"))}
      </div>
      <p className={`text-lg font-bold ${fg ? "" : "text-gray-900"}`}>{title}</p>
      <p className={`mt-1.5 text-sm ${fg ? "opacity-80" : "text-gray-500"}`}>{text}</p>
      <Link href={actionHref} className="btn-primary mt-5 inline-flex">{actionLabel || t("products.clear")}</Link>
    </div>
  );
}
