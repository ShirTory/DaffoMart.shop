import { createHash } from "crypto";
import { db } from "./db";
import { ApiError } from "./http";
import { isRealDate, isRevenueOrder, listExpenses, money, revenueDate } from "./finance";
import { profitLossFull } from "./accounting";
import { courierRows, isCourierExpense, summarize } from "./courier";
import type { AdCost, AdStatus, Order, Product } from "@/lib/types";

/* ---------------------------------------------------------------- ad costs */
export const AD_STATUSES: AdStatus[] = ["actual", "estimated", "unverified"];
const MAX = 1e9;
/** id = hash(date, platform, campaign, product): importing the same row again updates it instead of adding a second one. */
export const adCostId = (date: string, platform: string, campaign: string, productId?: string) =>
  createHash("sha1").update([date, platform.trim().toLowerCase(), campaign.trim().toLowerCase(), productId || "-"].join("|")).digest("hex").slice(0, 24);

export interface AdInput { date: string; platform: string; campaign: string; productId?: string; amountBdt?: unknown; amountUsd?: unknown; usdRate?: unknown; reportedOrders?: unknown; status?: AdStatus; note?: string }

/** Pure: validate one entry. BDT is required; USD is only recorded when the admin supplied it (or a rate to derive it from the BDT amount). */
export function normalizeAd(i: AdInput, products: Map<string, Product>, by: string, nowIso: string, prev?: AdCost | null): AdCost {
  if (!isRealDate(i.date)) throw new ApiError(400, "Date must be a real date (YYYY-MM-DD)");
  const platform = (i.platform || "").trim().slice(0, 40), campaign = (i.campaign || "").trim().slice(0, 120);
  if (!platform) throw new ApiError(400, "Platform is required (e.g. Facebook, Google, TikTok)");
  if (!campaign) throw new ApiError(400, "Campaign name is required");
  const usd = i.amountUsd === undefined || i.amountUsd === null || i.amountUsd === "" ? undefined : Number(i.amountUsd);
  const rate = i.usdRate === undefined || i.usdRate === null || i.usdRate === "" ? undefined : Number(i.usdRate);
  const bdtIn = i.amountBdt === undefined || i.amountBdt === null || i.amountBdt === "" ? undefined : Number(i.amountBdt);
  for (const [v, l] of [[usd, "USD amount"], [rate, "USD rate"], [bdtIn, "BDT amount"]] as const) if (v !== undefined && (!Number.isFinite(v) || v < 0 || v > MAX)) throw new ApiError(400, `${l} must be a positive number`);
  if (rate !== undefined && rate <= 0) throw new ApiError(400, "USD rate must be greater than 0");
  let bdt = bdtIn;
  if (bdt === undefined && usd !== undefined && rate !== undefined) bdt = usd * rate; // derived only from numbers the admin entered
  if (bdt === undefined || !(bdt > 0)) throw new ApiError(400, "Enter the cost in taka (or USD together with the USD→BDT rate you were charged at)");
  const pid = (i.productId || "").trim();
  if (pid && !products.has(pid)) throw new ApiError(400, "Unknown product for this ad cost");
  const ro = i.reportedOrders === undefined || i.reportedOrders === null || i.reportedOrders === "" ? undefined : Math.floor(Number(i.reportedOrders));
  if (ro !== undefined && (!Number.isFinite(ro) || ro < 0)) throw new ApiError(400, "Reported orders must be 0 or more");
  const status: AdStatus = i.status && AD_STATUSES.includes(i.status) ? i.status : prev?.status ?? "unverified";
  const id = adCostId(i.date, platform, campaign, pid || undefined);
  return {
    id, date: i.date, platform, campaign, ...(pid ? { productId: pid, productName: products.get(pid)?.name } : {}), amountBdt: money(bdt),
    ...(usd !== undefined ? { amountUsd: money(usd) } : {}), ...(rate !== undefined ? { usdRate: rate } : {}), ...(ro !== undefined ? { reportedOrders: ro } : {}),
    status, ...(i.note?.trim() ? { note: i.note.trim().slice(0, 300) } : {}), createdBy: prev?.createdBy ?? by, createdAt: prev?.createdAt ?? nowIso, updatedAt: nowIso,
  };
}

export async function listAdCosts(from?: string, to?: string) {
  return (await db.list<AdCost>("ad_costs")).filter((a) => (!from || a.date >= from) && (!to || a.date <= to)).sort((a, b) => b.date.localeCompare(a.date) || a.campaign.localeCompare(b.campaign));
}
/** Upsert rows (manual entry or CSV import). Same date+platform+campaign+product = same row, so nothing is ever doubled. */
export async function saveAdCosts(rows: AdInput[], by: string) {
  if (!rows.length) throw new ApiError(400, "Nothing to save");
  if (rows.length > 1000) throw new ApiError(400, "At most 1,000 rows at a time");
  const products = new Map((await db.list<Product>("products")).map((p) => [p.id, p]));
  const now = new Date().toISOString();
  const prepared = new Map<string, AdCost>();
  const errors: { row: number; message: string }[] = [];
  rows.forEach((r, k) => {
    try { const a = normalizeAd(r, products, by, now); if (prepared.has(a.id)) throw new ApiError(400, "Duplicate of an earlier row in this file (same date, platform, campaign and product)"); prepared.set(a.id, a); }
    catch (e: any) { errors.push({ row: k + 1, message: e?.message || "Invalid row" }); }
  });
  if (errors.length) return { saved: 0, created: 0, updated: 0, errors };
  let created = 0, updated = 0;
  for (const a of prepared.values()) {
    await db.mutate("ad_costs", a.id, (cur: AdCost | null) => { if (cur) { updated++; return { ...a, createdAt: cur.createdAt, createdBy: cur.createdBy }; } created++; return a; });
  }
  return { saved: prepared.size, created, updated, errors };
}
export async function deleteAdCost(id: string) { if (!(await db.get("ad_costs", id))) throw new ApiError(404, "Ad cost not found"); await db.remove("ad_costs", id); }

/* ---------------------------------------------------------------- analytics */
export interface ProductProfit { productId: string; name: string; units: number; revenue: number; cogs: number | null; directAds: number; sharedAds: number; profit: number | null; marginPct: number | null; costKnown: boolean }

/**
 * Pure: product-wise result from delivered orders.
 *  revenue = line price x qty minus the line's share of the order discount (by line value).
 *  cogs = unit cost recorded on the order line x qty (null when ANY line of the product has no recorded cost).
 *  ads = ad costs tagged to the product + shared (untagged) ad costs split by each product's share of revenue (method shown in the report).
 */
export function productProfits(orders: Order[], ads: AdCost[]): { rows: ProductProfit[]; sharedTotal: number; unallocatedShared: number } {
  const acc = new Map<string, { name: string; units: number; revenue: number; cogs: number; costKnown: boolean }>();
  for (const o of orders) {
    const lineTotal = o.items.reduce((n, x) => n + x.price * x.qty, 0) || 1;
    for (const x of o.items) {
      const a = acc.get(x.id) ?? { name: x.name, units: 0, revenue: 0, cogs: 0, costKnown: true };
      a.units += x.qty; a.revenue += x.price * x.qty - (o.discount || 0) * ((x.price * x.qty) / lineTotal);
      if (x.cost === undefined) a.costKnown = false; else a.cogs += x.cost * x.qty;
      acc.set(x.id, a);
    }
  }
  const direct = new Map<string, number>(); let shared = 0;
  for (const a of ads) { if (a.productId) direct.set(a.productId, (direct.get(a.productId) || 0) + a.amountBdt); else shared += a.amountBdt; }
  const totalRev = [...acc.values()].reduce((n, a) => n + a.revenue, 0);
  const rows: ProductProfit[] = [...acc.entries()].map(([id, a]) => {
    const sh = totalRev > 0 ? shared * (a.revenue / totalRev) : 0, d = direct.get(id) || 0;
    const rev = money(a.revenue), cogs = a.costKnown ? money(a.cogs) : null;
    const profit = cogs === null ? null : money(rev - cogs - d - sh);
    return { productId: id, name: a.name, units: a.units, revenue: rev, cogs, directAds: money(d), sharedAds: money(sh), profit, marginPct: profit === null || rev <= 0 ? null : money((profit / rev) * 100), costKnown: a.costKnown };
  }).sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));
  const taggedToUnsold = [...direct.entries()].filter(([id]) => !acc.has(id)).reduce((n, [, v]) => n + v, 0);
  // ad money that could not be placed on any product row (no sales in the period) stays visible instead of vanishing
  return { rows, sharedTotal: money(shared), unallocatedShared: money((totalRev > 0 ? 0 : shared) + taggedToUnsold) };
}

export async function profitAnalytics(from: string, to: string) {
  const [orders, adsAll, pl, courier] = await Promise.all([db.list<Order>("orders"), listAdCosts(from, to), profitLossFull(from, to), courierRows(from, to)]);
  const delivered = orders.filter((o) => isRevenueOrder(o) && revenueDate(o) >= from && revenueDate(o) <= to);
  const grossItemSales = money(delivered.reduce((n, o) => n + o.subtotal + (o.serviceCharge || 0), 0));
  const discounts = money(delivered.reduce((n, o) => n + (o.discount || 0), 0));
  const deliveryFees = money(delivered.reduce((n, o) => n + (o.delivery || 0), 0));
  const revenue = money(delivered.reduce((n, o) => n + (o.total || 0), 0));
  const noCost = delivered.filter((o) => !o.items.length || o.items.some((x) => x.cost === undefined));
  const cogs = money(delivered.filter((o) => !noCost.includes(o)).reduce((n, o) => n + o.items.reduce((m, x) => m + x.qty * (x.cost as number), 0), 0));
  const cogsComplete = noCost.length === 0;

  const cs = summarize(courier);
  const cv = courier.filter((r) => r.verified), cu = courier.filter((r) => !r.verified);
  const courierVerified = money(cv.reduce((n, r) => n + r.companyDeliveryCharge + r.companyReturnCharge, 0));
  const courierUnverified = money(cu.filter((r) => r.parcelStatus !== "cancelled").reduce((n, r) => n + r.companyDeliveryCharge + r.companyReturnCharge, 0));
  const deliveryExpenseVerified = money(cv.reduce((n, r) => n + r.deliveryExpense, 0)), returnLossVerified = money(cv.reduce((n, r) => n + r.returnLoss, 0));

  const adBy = (s: AdStatus) => money(adsAll.filter((a) => a.status === s).reduce((n, a) => n + a.amountBdt, 0));
  const adActual = adBy("actual"), adEstimated = adBy("estimated"), adUnverified = adBy("unverified");
  const adTotal = money(adActual + adEstimated + adUnverified);

  // other recorded expenses: everything in Accounts except inventory purchases and the courier lines (counted above, not twice)
  const manual = (await listExpenses(from, to)).filter((e) => e.category !== "Purchase" && !isCourierExpense(e.id));
  const otherExpenses = money(manual.reduce((n, e) => n + e.amount, 0) + pl.salaryExpense + pl.riderExpense);
  const marketingManual = money(manual.filter((e) => /market|advert|ads?\b/i.test(e.category)).reduce((n, e) => n + e.amount, 0));

  const profit = (extra: number) => (cogsComplete ? money(revenue - cogs - courierVerified - otherExpenses - extra) : null);
  const pct = (v: number | null) => (v === null || revenue <= 0 ? null : money((v / revenue) * 100));
  const actual = profit(adActual), withEst = profit(adActual + adEstimated), withAll = cogsComplete ? money(revenue - cogs - courierVerified - courierUnverified - otherExpenses - adTotal) : null;

  const pp = productProfits(delivered, adsAll);
  const ranked = pp.rows.filter((r) => r.profit !== null);
  const usdRows = adsAll.filter((a) => a.amountUsd !== undefined);
  const usdSpend = money(usdRows.reduce((n, a) => n + (a.amountUsd as number), 0));
  const n = delivered.length;
  return {
    range: { from, to }, deliveredOrders: n,
    sales: { grossItemSales, discounts, deliveryFees, revenue, note: "Revenue = order totals of orders delivered in the period (same basis as Accounts)." },
    costs: {
      cogs: cogsComplete ? cogs : null, cogsKnownPart: cogs, ordersWithoutCost: noCost.length, revenueWithoutCost: money(noCost.reduce((n, o) => n + o.total, 0)),
      courierVerified, deliveryExpenseVerified, returnLossVerified, courierUnverified, otherExpenses, marketingManual,
      adActual, adEstimated, adUnverified, adTotal,
    },
    profit: {
      actual, actualMarginPct: pct(actual), withEstimatedAds: withEst, withEstimatedAdsMarginPct: pct(withEst), withEverything: withAll, withEverythingMarginPct: pct(withAll),
      note: cogsComplete
        ? "ACTUAL = revenue - recorded product cost - verified courier costs - other recorded expenses (payroll, rider pay, manual expenses) - ad costs marked Actual. Estimated and unverified items are shown separately and are NOT in the Actual figure."
        : `${noCost.length} of ${n} delivered orders have no recorded product cost, so profit is not reported (nothing is guessed). Revenue of those orders: ৳${money(noCost.reduce((n, o) => n + o.total, 0))}.`,
    },
    advertising: {
      totalSpendBdt: adTotal, byStatus: { actual: adActual, estimated: adEstimated, unverified: adUnverified }, entries: adsAll.length,
      costPerOrder: n > 0 && adTotal > 0 ? money(adTotal / n) : null, costPerOrderBasis: "All ad costs / all delivered orders in the period (not only orders the ads brought in).",
      spendUsd: usdRows.length ? usdSpend : null, ordersPerUsd: usdRows.length && usdSpend > 0 ? money(n / usdSpend) : null,
      usdNote: usdRows.length === adsAll.length ? "" : (adsAll.length - usdRows.length === 1 ? "1 entry has no USD amount and is left out of the per-USD figure." : `${adsAll.length - usdRows.length} entries have no USD amount and are left out of the per-USD figure.`),
      sharedTotal: pp.sharedTotal, unallocated: pp.unallocatedShared, allocationMethod: "Ad costs tagged to a product go to that product. Untagged (shared) costs are split by each product's share of delivered revenue.",
      doubleCountWarning: marketingManual > 0 && adTotal > 0 ? `Accounts also has ৳${marketingManual} of manual Marketing/Advertising expenses in this period. They are counted in "other expenses"; if they are the same spend as the ad costs above, delete one of them.` : "",
    },
    courier: { summary: cs, unverifiedParcels: cs.unverifiedParcels },
    products: { rows: pp.rows, best: ranked.slice(0, 5), worst: ranked.length > 5 ? ranked.slice(-5).reverse() : [...ranked].reverse().slice(0, Math.min(5, ranked.length)), costUnknown: pp.rows.filter((r) => !r.costKnown).map((r) => ({ productId: r.productId, name: r.name, revenue: r.revenue })), note: "Product profit excludes courier charges, payroll and other business-wide expenses (they are not product-specific and are not allocated)." },
  };
}
