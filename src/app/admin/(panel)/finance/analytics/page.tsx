"use client";
import { useMemo, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Empty, ErrorBox, Field, Modal, PageHeader, PageLoader, Spinner, useConfirm, useList, useToast } from "@/components/admin/ui";
import type { AdCost, AdStatus, Product } from "@/lib/types";

type A = Awaited<ReturnType<typeof import("@/server/analytics").profitAnalytics>>;
/** today in Bangladesh time (the server dates revenue by Dhaka days) */
const ymdNow = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
const monthStart = () => ymdNow().slice(0, 7) + "-01";
const t2 = (n: number | null | undefined) => (n === null || n === undefined ? "Not available" : `৳${(Math.round(n * 100) / 100).toLocaleString("en-US")}`);
const pc = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n}%`);
const BADGE: Record<AdStatus, string> = { actual: "bg-emerald-100 text-emerald-700", estimated: "bg-amber-100 text-amber-700", unverified: "bg-gray-100 text-gray-600" };

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "muted" }) {
  const c = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-600" : tone === "muted" ? "text-gray-500" : "text-gray-900";
  return <div className="card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p><p className={`mt-1 text-xl font-bold ${c}`}>{value}</p>{sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}</div>;
}
const tone = (v: number | null | undefined) => (v === null || v === undefined ? "muted" : v >= 0 ? "good" : "bad") as "good" | "bad" | "muted";

/** minimal CSV reader (quotes, commas, newlines) */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); if (row.some((c) => c.trim())) rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  row.push(cur); if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

export default function ProfitAdsPage() {
  const toast = useToast(); const { confirm, node } = useConfirm();
  const [from, setFrom] = useState(monthStart()); const [to, setTo] = useState(ymdNow());
  const an = useList<A>(`/api/admin/finance/analytics?from=${from}&to=${to}`);
  const ads = useList<AdCost[]>(`/api/admin/finance/ad-costs?from=${from}&to=${to}`);
  const prodRes = useList<{ items: Product[] }>("/api/products?limit=500"); const prods = { data: prodRes.data?.items };
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const blank = { date: ymdNow(), platform: "Facebook", campaign: "", productId: "", amountBdt: "", amountUsd: "", usdRate: "", reportedOrders: "", status: "unverified", note: "" };
  const [f, setF] = useState(blank);
  const [csv, setCsv] = useState(""); const [imp, setImp] = useState(false); const [rowErrs, setRowErrs] = useState<{ row: number; message: string }[]>([]);
  const reloadAll = () => { an.reload(); ads.reload(); };

  const save = async () => {
    setBusy(true); setErrs({});
    try { await api("/api/admin/finance/ad-costs", { method: "POST", body: { ...f, status: f.status } }); toast("Ad cost saved"); setOpen(false); setF(blank); reloadAll(); }
    catch (e: any) { if (e instanceof ApiClientError) setErrs(e.fields || {}); toast(e.message, "err"); } finally { setBusy(false); }
  };
  const del = async (a: AdCost) => { if (!(await confirm(`Delete ad cost "${a.campaign}" (${a.date})?`))) return; try { await api(`/api/admin/finance/ad-costs/${a.id}`, { method: "DELETE" }); toast("Deleted"); reloadAll(); } catch (e: any) { toast(e.message, "err"); } };

  /** columns: date, platform, campaign, product (id or exact name, optional), amount_bdt, amount_usd, usd_rate, orders, status */
  const doImport = async () => {
    const rows = parseCsv(csv); if (rows.length < 2) return toast("Paste a header row and at least one data row", "err");
    const head = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
    const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
    const ix = { date: col("date", "day"), platform: col("platform", "channel"), campaign: col("campaign", "campaignname"), product: col("product", "productid", "productname"), bdt: col("amountbdt", "bdt", "taka", "amount", "cost", "spend"), usd: col("amountusd", "usd"), rate: col("usdrate", "rate"), orders: col("orders", "reportedorders", "results"), status: col("status") };
    if (ix.date < 0 || ix.platform < 0 || ix.campaign < 0) return toast("The first row must name the columns: date, platform, campaign (plus amount_bdt and/or amount_usd + usd_rate)", "err");
    const list = prods.data ?? []; const out: Record<string, unknown>[] = []; const pre: { row: number; message: string }[] = [];
    rows.slice(1).forEach((r, k) => {
      const g = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
      let productId = ""; const pv = g(ix.product);
      if (pv) { const m = list.find((p) => p.id === pv || p.name.toLowerCase() === pv.toLowerCase() || p.sku?.toLowerCase() === pv.toLowerCase()); if (!m) pre.push({ row: k + 1, message: `Unknown product "${pv}"` }); else productId = m.id; }
      const st = g(ix.status).toLowerCase();
      out.push({ date: g(ix.date), platform: g(ix.platform), campaign: g(ix.campaign), productId, amountBdt: g(ix.bdt), amountUsd: g(ix.usd), usdRate: g(ix.rate), reportedOrders: g(ix.orders), status: ["actual", "estimated", "unverified"].includes(st) ? st : "unverified" });
    });
    if (pre.length) { setRowErrs(pre); return; }
    setImp(true); setRowErrs([]);
    try {
      const res = await api<{ saved: number; created: number; updated: number; errors: { row: number; message: string }[] }>("/api/admin/finance/ad-costs", { method: "POST", body: { rows: out } });
      if (res.errors.length) { setRowErrs(res.errors); toast("Nothing was imported — fix the listed rows", "err"); }
      else { toast(`Imported: ${res.created} new, ${res.updated} updated`); setCsv(""); reloadAll(); }
    } catch (e: any) { toast(e.message, "err"); } finally { setImp(false); }
  };

  const a = an.data;
  const productName = useMemo(() => new Map((prods.data ?? []).map((p) => [p.id, p.name])), [prods.data]);
  return (
    <>
      <PageHeader title="Profit, Loss & Advertising" subtitle="Calculated from delivered orders, recorded product costs, verified courier costs, Accounts and your ad costs. Unknown figures are shown as unknown, never guessed.">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="From"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
      </PageHeader>
      {an.loading ? <PageLoader /> : an.error || !a ? <ErrorBox msg={an.error || "Failed to load"} retry={an.reload} /> : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 font-bold">Profit &amp; loss <span className="text-xs font-normal text-gray-500">({a.deliveredOrders} delivered orders)</span></h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card label="Revenue" value={t2(a.sales.revenue)} sub={`items ${t2(a.sales.grossItemSales)} − discounts ${t2(a.sales.discounts)} + delivery fees ${t2(a.sales.deliveryFees)}`} />
              <Card label="Product cost (COGS)" value={t2(a.costs.cogs)} sub={a.costs.ordersWithoutCost ? `${a.costs.ordersWithoutCost} order(s) have no recorded cost` : "recorded cost on every order line"} tone={a.costs.cogs === null ? "muted" : undefined} />
              <Card label="Verified courier cost" value={t2(a.costs.courierVerified)} sub={`delivery ${t2(a.costs.deliveryExpenseVerified)} · return loss ${t2(a.costs.returnLossVerified)}`} />
              <Card label="Other recorded expenses" value={t2(a.costs.otherExpenses)} sub="manual expenses, payroll, rider pay" />
              <Card label="Net profit — ACTUAL" value={t2(a.profit.actual)} sub={`margin ${pc(a.profit.actualMarginPct)} · uses only ad costs marked Actual`} tone={tone(a.profit.actual)} />
              <Card label="… incl. ESTIMATED ads" value={t2(a.profit.withEstimatedAds)} sub={`margin ${pc(a.profit.withEstimatedAdsMarginPct)}`} tone={tone(a.profit.withEstimatedAds)} />
              <Card label="… incl. everything unverified" value={t2(a.profit.withEverything)} sub={`margin ${pc(a.profit.withEverythingMarginPct)} · adds unverified ads ${t2(a.costs.adUnverified)} and unverified courier ${t2(a.costs.courierUnverified)}`} tone={tone(a.profit.withEverything)} />
            </div>
            <p className="mt-2 text-xs text-gray-500">{a.profit.note}</p>
          </section>

          <section>
            <h2 className="mb-2 font-bold">Advertising</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card label="Total ad spend" value={t2(a.advertising.totalSpendBdt)} sub={`actual ${t2(a.advertising.byStatus.actual)} · estimated ${t2(a.advertising.byStatus.estimated)} · unverified ${t2(a.advertising.byStatus.unverified)}`} />
              <Card label="Cost per order" value={t2(a.advertising.costPerOrder)} sub="all ad spend ÷ all delivered orders" />
              <Card label="Orders per USD spent" value={a.advertising.ordersPerUsd === null ? "Not available" : String(a.advertising.ordersPerUsd)} sub={a.advertising.spendUsd === null ? "needs ad costs entered in USD" : `USD spend ${a.advertising.spendUsd}`} />
              <Card label="Shared (untagged) ad cost" value={t2(a.advertising.sharedTotal)} sub="split by product revenue" />
            </div>
            {a.advertising.usdNote && <p className="mt-2 text-xs text-amber-700">{a.advertising.usdNote}</p>}
            {a.advertising.doubleCountWarning && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">⚠ {a.advertising.doubleCountWarning}</p>}
            {a.advertising.unallocated > 0 && <p className="mt-2 text-xs text-amber-700">{t2(a.advertising.unallocated)} of ad cost could not be placed on a product row (no sales in this period). It is still in the totals above.</p>}
            <p className="mt-2 text-xs text-gray-500">{a.advertising.allocationMethod}</p>
          </section>

          <section>
            <h2 className="mb-2 font-bold">Products</h2>
            {!a.products.rows.length ? <Empty icon="products" title="No delivered sales in this period" /> : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="card p-4"><p className="mb-1 text-sm font-bold text-emerald-700">Best performers</p>{a.products.best.length ? a.products.best.map((p) => <p key={p.productId} className="flex justify-between text-sm"><span className="truncate pr-2">{p.name}</span><span>{t2(p.profit)}</span></p>) : <p className="text-sm text-gray-500">No product with a recorded cost yet.</p>}</div>
                  <div className="card p-4"><p className="mb-1 text-sm font-bold text-red-600">Worst performers</p>{a.products.worst.length ? a.products.worst.map((p) => <p key={p.productId} className="flex justify-between text-sm"><span className="truncate pr-2">{p.name}</span><span>{t2(p.profit)}</span></p>) : <p className="text-sm text-gray-500">—</p>}</div>
                </div>
                <div className="card mt-3 overflow-x-auto">
                  <table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-gray-500">{["Product", "Units", "Revenue", "Cost", "Direct ads", "Shared ads", "Profit / loss", "Margin"].map((h) => <th key={h} className="th whitespace-nowrap">{h}</th>)}</tr></thead>
                    <tbody>{a.products.rows.map((p) => (
                      <tr key={p.productId} className="border-t"><td className="td">{p.name}</td><td className="td">{p.units}</td><td className="td">{t2(p.revenue)}</td><td className="td">{p.cogs === null ? "unknown" : t2(p.cogs)}</td><td className="td">{t2(p.directAds)}</td><td className="td">{t2(p.sharedAds)}</td>
                        <td className={`td font-semibold ${p.profit === null ? "text-gray-400" : p.profit < 0 ? "text-red-600" : "text-emerald-700"}`}>{p.profit === null ? "cost unknown" : t2(p.profit)}</td><td className="td">{pc(p.marginPct)}</td></tr>))}</tbody></table>
                </div>
                <p className="mt-2 text-xs text-gray-500">{a.products.note}</p>
              </>)}
          </section>
        </div>)}

      <section className="mt-8">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Ad costs</h2><button className="btn-primary btn-sm" onClick={() => { setErrs({}); setF(blank); setOpen(true); }}>Add ad cost</button></div>
        {ads.loading ? <PageLoader /> : !ads.data?.length ? <Empty icon="trend" title="No ad costs in this period" hint="Add one by hand or import a CSV below." /> : (
          <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-gray-500">{["Date", "Platform", "Campaign", "Product", "Cost ৳", "USD", "Status", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{ads.data.map((x) => <tr key={x.id} className="border-t"><td className="td whitespace-nowrap">{x.date}</td><td className="td">{x.platform}</td><td className="td">{x.campaign}</td><td className="td">{x.productId ? (x.productName || productName.get(x.productId) || x.productId) : <span className="text-gray-400">shared</span>}</td><td className="td">{t2(x.amountBdt)}</td><td className="td">{x.amountUsd ?? "—"}</td><td className="td"><span className={`badge ${BADGE[x.status]}`}>{x.status}</span></td><td className="td"><button className="btn-ghost btn-sm text-red-600" onClick={() => del(x)}>Delete</button></td></tr>)}</tbody></table></div>)}
        <details className="card mt-4 p-4">
          <summary className="cursor-pointer font-semibold">Import ad costs from CSV</summary>
          <p className="mt-2 text-xs text-gray-500">Paste rows copied from your ad platform export. First row = column names: <code>date, platform, campaign, product, amount_bdt, amount_usd, usd_rate, orders, status</code> (product, USD columns, orders and status are optional; dates as YYYY-MM-DD). The same date + platform + campaign + product updates the existing entry instead of adding another. If any row is invalid nothing is imported.</p>
          <textarea className="input mt-2 min-h-[120px] font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"date,platform,campaign,product,amount_bdt,amount_usd,usd_rate,status\n2026-10-05,Facebook,Eid sale,,1200,10,120,actual"} />
          {rowErrs.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-red-600">{rowErrs.slice(0, 20).map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}</ul>}
          <button className="btn-primary mt-2" onClick={doImport} disabled={imp || !csv.trim()}>{imp && <Spinner className="h-4 w-4" />}Import</button>
        </details>
      </section>

      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Add ad cost" footer={<><button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save</button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" error={errs.date}><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Platform" error={errs.platform}><input className="input" list="plat" value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} /><datalist id="plat"><option value="Facebook" /><option value="Instagram" /><option value="Google" /><option value="TikTok" /><option value="YouTube" /></datalist></Field>
          <Field label="Campaign" error={errs.campaign}><input className="input" value={f.campaign} onChange={(e) => setF({ ...f, campaign: e.target.value })} /></Field>
          <Field label="Product" hint="Leave empty for a shared cost"><select className="input" value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}><option value="">Shared (all products)</option>{(prods.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Cost in taka (৳)" hint="Or enter USD + rate" error={errs.amountBdt}><input className="input" type="number" min="0" value={f.amountBdt} onChange={(e) => setF({ ...f, amountBdt: e.target.value })} /></Field>
          <Field label="Cost in USD (optional)"><input className="input" type="number" min="0" value={f.amountUsd} onChange={(e) => setF({ ...f, amountUsd: e.target.value })} /></Field>
          <Field label="USD → BDT rate you were charged"><input className="input" type="number" min="0" value={f.usdRate} onChange={(e) => setF({ ...f, usdRate: e.target.value })} /></Field>
          <Field label="Orders reported by the platform (optional)"><input className="input" type="number" min="0" value={f.reportedOrders} onChange={(e) => setF({ ...f, reportedOrders: e.target.value })} /></Field>
          <Field label="Status" hint="Actual = matches an invoice/statement. Estimated = your estimate. Unverified = not checked yet."><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="actual">Actual</option><option value="estimated">Estimated</option><option value="unverified">Unverified</option></select></Field>
          <Field label="Note"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        </div>
      </Modal>
      {node}
    </>
  );
}
