"use client";
import { useEffect, useState } from "react";
import ProductPage, { type ProductPageData } from "@/components/product/ProductPage";
import { validateLayout } from "@/lib/productPage";

/** Renders the real product page; the builder (parent window, same origin) sends the layout being edited. */
export default function PreviewClient({ initial }: { initial: ProductPageData }) {
  const [layout, setLayout] = useState(initial.layout);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== "pp-layout") return;
      const v = validateLayout(e.data.layout);
      if (v.ok) setLayout(v.layout); // an invalid in-progress layout never breaks the preview: it keeps the last valid one
    };
    window.addEventListener("message", on);
    window.parent?.postMessage({ type: "pp-ready" }, window.location.origin);
    return () => window.removeEventListener("message", on);
  }, []);
  return <ProductPage data={{ ...initial, layout }} />;
}
