import { notFound } from "next/navigation";
import { getFullAdmin } from "@/server/auth";
import { db } from "@/server/db";
import { getSettings } from "@/server/queries";
import { editorLayout, type LayoutDoc } from "@/server/productPage";
import { buildProductPageData } from "@/server/productPageData";
import PreviewClient from "./PreviewClient";
import type { Category, Product } from "@/lib/types";
export const dynamic = "force-dynamic";

/** Admin-only: the real product page for any product (even hidden/unpublished), showing the DRAFT layout. The builder pushes live edits into it with postMessage. */
export default async function PreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ scope?: string }> }) {
  if (!(await getFullAdmin())) notFound();
  const { id } = await params; const { scope = "global" } = await searchParams;
  const [all, categories, docs, settings] = await Promise.all([db.list<Product>("products"), db.list<Category>("categories"), db.list<LayoutDoc>("product_layouts"), getSettings()]);
  const p = all.find((x) => x.id === id); if (!p) notFound();
  const { cost, ...safe } = p; void cost;
  const visible = all.filter((x) => x.active).map(({ cost: _c, ...r }) => r as Product);
  const data = await buildProductPageData(safe as Product, visible, categories, docs, { layoutOverride: editorLayout(scope === "global" ? "global" : scope, docs), whatsapp: settings.whatsapp, preview: true });
  return <PreviewClient initial={data} />;
}
