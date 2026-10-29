"use client";

import Link from "next/link";
import type { Category } from "@/lib/types";

/** Circular category icon — image preferred, letter fallback (no emoji). */
export function CategoryIcon({
  category,
  size = "md",
  className = "",
}: {
  category: Pick<Category, "name" | "image" | "iconBg">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim = size === "sm" ? "h-10 w-10 text-sm" : size === "lg" ? "h-14 w-14 text-lg" : "h-12 w-12 text-base";
  const letter = (category.name || "?").trim().charAt(0).toUpperCase();
  const bg = category.iconBg?.trim() || undefined;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-gray-200/80 shadow-sm ${dim} ${className}`}
      style={{ background: bg || "linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%)" }}
      aria-hidden
    >
      {category.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={category.image} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <span className="font-bold text-gray-600">{letter}</span>
      )}
    </span>
  );
}

/** Header / chip style: circle icon + bold name under it */
export function CategoryChip({
  href,
  name,
  image,
  iconBg,
  active,
}: {
  href: string;
  name: string;
  image?: string;
  iconBg?: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group cat-link flex w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition sm:w-[5rem] ${
        active ? "bg-primary-soft" : "hover:bg-gray-50"
      }`}
    >
      <CategoryIcon category={{ name, image, iconBg }} size="md" className={`cat-float ${active ? "ring-2 ring-primary" : "group-hover:ring-primary/40"}`} />
      <span className={`line-clamp-2 w-full text-center text-[11px] font-bold leading-tight sm:text-xs ${active ? "text-primary" : "text-gray-800"}`}>
        {name}
      </span>
    </Link>
  );
}
