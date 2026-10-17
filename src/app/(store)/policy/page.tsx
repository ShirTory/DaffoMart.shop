import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/server/queries";
import { makeT } from "@/lib/texts";
import { pageMeta } from "@/lib/seo";
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return pageMeta({ title: makeT(s.texts)("policy.title"), description: `Return and exchange policy of ${s.storeName}.`, path: "/policy" });
}

export default async function PolicyPage() {
  const s = await getSettings(); const t = makeT(s.texts);
  const ret = s.returnPolicy || "Contact support for return assistance within 24 hours of delivery.";
  const ex = s.exchangePolicy || "Damaged or incorrect items can be exchanged — contact us with your order number.";
  return (
    <div className="mx-auto max-w-3xl py-4">
      <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{t("policy.title")}</h1>
      <p className="mt-2 text-sm text-gray-500">{s.storeName} — {s.tagline}</p>
      <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">{t("policy.returns")}</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{ret}</p>
      </section>
      <section className="mt-4 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">{t("policy.exchanges")}</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{ex}</p>
      </section>
      <p className="mt-8 text-center text-sm text-gray-500">
        {t("policy.help")} <Link href="/contact" className="font-semibold text-primary hover:underline">{t("header.contact")}</Link>
      </p>
    </div>
  );
}
