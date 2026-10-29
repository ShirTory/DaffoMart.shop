/**
 * Excel (.xlsx) export / import for products, inventory, orders, customers and reports.
 *
 *  - Import is TWO-STEP: "preview" validates every row and changes nothing; "commit" applies only the valid rows.
 *  - Duplicates: products are matched by SKU, customers by normalized phone, inventory by SKU. The same key twice in one file
 *    is an error on the second row; a key that already exists is an update (or is skipped with mode "skip_existing").
 *  - Orders and reports are export-only on purpose: importing orders would bypass stock, payment and finance rules.
 *  - Stock of EXISTING products is changed only through the Inventory import (which writes the stock log), never by the Products import.
 */
import { buildXlsx, cleanCell, excelSerialToDate, parseXlsx, XlsxError, type Cell, type SheetIn } from "./xlsx";
import { db, newId } from "./db";
import { ApiError } from "./http";
import { adjustStock } from "./services";
import { productCfg } from "./resources";
import { productSchema } from "@/lib/validators";
import { filterCustomers, present, upsertCustomerFromImport, parseCustomerInput } from "./customers";
import type { Category, Customer, Order, Product } from "@/lib/types";

export type Dataset = "products" | "inventory" | "orders" | "customers" | "reports";
export const DATASETS: Dataset[] = ["products", "inventory", "orders", "customers", "reports"];
export const IMPORTABLE: Dataset[] = ["products", "inventory", "customers"];
export const MAX_IMPORT_ROWS = 2000;

export const COLUMNS = {
  products: ["SKU", "Name", "Category", "Price", "Old Price", "Unit", "Stock", "Active", "Featured", "Offer Starts", "Offer Ends", "Description", "Image URL"],
  inventory: ["SKU", "Name", "Category", "Stock", "Adjust", "Reason", "Unit", "Status"],
  customers: ["Phone", "Name", "WhatsApp", "Email", "Address", "Area", "Status", "Segment", "Notes", "Orders", "Total Spent", "Last Order"],
  orders: ["Order No", "Date", "Status", "Customer", "Phone", "Address", "Area", "Items", "Subtotal", "Discount", "Delivery", "Service Charge", "Total", "Payment", "Payment Status", "TrxID", "Rider", "Courier", "Tracking", "Note"],
} as const;
const HELP: Record<string, [string, string][]> = {
  products: [["SKU", "Required. Letters, numbers, - and _. Existing SKU = update, new SKU = create."], ["Name", "Required for new products."], ["Category", "Must match an existing category name."], ["Price", "Required for new products. Plain number."], ["Old Price", "Regular price before the discount. Blank = keep, 0 = remove."], ["Stock", "Used for NEW products only. Existing stock is changed through the Inventory import."], ["Active / Featured", "Yes or No."], ["Offer Starts / Offer Ends", "YYYY-MM-DD. Optional offer window (end date inclusive)."], ["Image URL", "https://… or /api/uploads/…"]],
  inventory: [["SKU", "Required. Must already exist."], ["Stock", "New absolute stock count (set)."], ["Adjust", "Or a signed change, e.g. +20 or -3. Use Stock OR Adjust, not both."], ["Reason", "Optional note saved in the stock log."]],
  customers: [["Phone", "Required, 01XXXXXXXXX. This is the unique key: no duplicates are created."], ["Name", "Required."], ["Status", "active, inactive or blocked."], ["Segment", "Leave blank for automatic, or new / regular / vip / inactive."], ["Orders, Total Spent, Last Order", "Read-only: calculated from real orders and ignored on import."], ["Blank cells", "Never erase existing data."]],
};

/* ---------- value helpers (pure) ---------- */
const ci = (s: string) => s.trim().toLowerCase();
export function num(v: string): number | null { const s = v.replace(/[৳,\s]|BDT|Tk/gi, ""); if (s === "" || !/^[+-]?\d+(\.\d+)?$/.test(s)) return null; return Number(s); }
export function flag(v: string): boolean | null { const s = ci(v); if (["yes", "y", "true", "1", "active"].includes(s)) return true; if (["no", "n", "false", "0", "inactive"].includes(s)) return false; return null; }
/** YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY or an Excel serial -> YYYY-MM-DD; null when invalid. */
export function dateOf(v: string): string | null {
  const s = v.trim(); let iso = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = s;
  else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(s)) { const [d, m, y] = s.split(/[/-]/); iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; }
  else if (/^\d{5}(\.\d+)?$/.test(s)) iso = excelSerialToDate(Number(s));
  if (!iso) return null; const d = new Date(iso + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

/** Turns a sheet grid into row objects keyed by the canonical header (case-insensitive). Reports missing required headers and ignored columns. */
export function readTable(rows: string[][], known: readonly string[], required: string[]) {
  const head = (rows[0] ?? []).map((h) => cleanCell(h)); const idx = new Map<string, number>();
  head.forEach((h, i) => { const k = known.find((x) => ci(x) === ci(h)); if (k && !idx.has(k)) idx.set(k, i); });
  const missing = required.filter((r) => !idx.has(r));
  const ignored = head.filter((h) => h && !known.some((x) => ci(x) === ci(h)));
  const data: { row: number; cells: Record<string, string> }[] = [];
  for (let r = 1; r < rows.length; r++) {
    const raw = rows[r] ?? []; if (!raw.some((c) => cleanCell(c))) continue; // skip empty rows
    const cells: Record<string, string> = {}; for (const [k, i] of idx) cells[k] = cleanCell(raw[i]);
    data.push({ row: r + 1, cells });
  }
  return { data, missing, ignored };
}

/* ---------- import row parsers (pure, unit-tested) ---------- */
export type RowResult<T> = { ok: true; value: T } | { ok: false; error: string };
export interface ProductPatch { sku: string; name?: string; categoryId?: string; price?: number; oldPrice?: number; unit?: string; stock?: number; active?: boolean; featured?: boolean; offerStartsAt?: string; offerEndsAt?: string; description?: string; image?: string }

export function parseProductRow(c: Record<string, string>, cats: Category[], isNew: boolean): RowResult<ProductPatch> {
  const sku = c.SKU.toUpperCase(); if (!sku) return { ok: false, error: "SKU is required" }; if (!/^[A-Z0-9_-]{1,64}$/.test(sku)) return { ok: false, error: "SKU: letters, numbers, - and _ only (max 64)" };
  const v: ProductPatch = { sku };
  if (c.Name) { if (c.Name.length < 2 || c.Name.length > 120) return { ok: false, error: "Name must be 2–120 characters" }; v.name = c.Name; } else if (isNew) return { ok: false, error: "Name is required for a new product" };
  if (c.Category) { const cat = cats.find((x) => ci(x.name) === ci(c.Category) || x.id === c.Category); if (!cat) return { ok: false, error: `Category “${c.Category}” does not exist` }; v.categoryId = cat.id; } else if (isNew) return { ok: false, error: "Category is required for a new product" };
  if (c.Price) { const n = num(c.Price); if (n === null || n < 0) return { ok: false, error: "Price must be a number, 0 or more" }; v.price = n; } else if (isNew) return { ok: false, error: "Price is required for a new product" };
  if (c["Old Price"]) { const n = num(c["Old Price"]); if (n === null || n < 0) return { ok: false, error: "Old Price must be a number, 0 or more" }; v.oldPrice = n; }
  if (v.oldPrice && v.price !== undefined && v.oldPrice < v.price) return { ok: false, error: "Old Price must be higher than Price (it is the price before the discount)" };
  if (c.Unit) { if (c.Unit.length > 40) return { ok: false, error: "Unit is too long (max 40)" }; v.unit = c.Unit; }
  if (c.Stock) { const n = num(c.Stock); if (n === null || !Number.isInteger(n) || n < 0) return { ok: false, error: "Stock must be a whole number, 0 or more" }; if (isNew) v.stock = n; }
  for (const [col, key] of [["Active", "active"], ["Featured", "featured"]] as const) if (c[col]) { const b = flag(c[col]); if (b === null) return { ok: false, error: `${col} must be Yes or No` }; v[key] = b; }
  for (const [col, key] of [["Offer Starts", "offerStartsAt"], ["Offer Ends", "offerEndsAt"]] as const) if (c[col]) { const d = dateOf(c[col]); if (!d) return { ok: false, error: `${col} must be a date like 2026-11-30` }; v[key] = d; }
  if (v.offerStartsAt && v.offerEndsAt && v.offerEndsAt < v.offerStartsAt) return { ok: false, error: "Offer Ends is before Offer Starts" };
  if (c.Description) { if (c.Description.length > 5000) return { ok: false, error: "Description is too long (max 5000)" }; v.description = c.Description; }
  if (c["Image URL"]) { if (!(/^https?:\/\//.test(c["Image URL"]) || (c["Image URL"].startsWith("/") && !c["Image URL"].startsWith("//")))) return { ok: false, error: "Image URL must start with https:// or /" }; v.image = c["Image URL"]; }
  return { ok: true, value: v };
}

export interface StockPatch { sku: string; mode: "set" | "add" | "remove"; qty: number; reason: string }
export function parseInventoryRow(c: Record<string, string>): RowResult<StockPatch> {
  const sku = c.SKU.toUpperCase(); if (!sku) return { ok: false, error: "SKU is required" };
  if (c.Stock && c.Adjust) return { ok: false, error: "Fill either Stock or Adjust, not both" };
  if (!c.Stock && !c.Adjust) return { ok: false, error: "Fill Stock (new count) or Adjust (+/- change)" };
  const reason = (c.Reason || "Excel import").slice(0, 80);
  if (c.Stock) { const n = num(c.Stock); if (n === null || !Number.isInteger(n) || n < 0 || n > 1_000_000) return { ok: false, error: "Stock must be a whole number between 0 and 1,000,000" }; return { ok: true, value: { sku, mode: "set", qty: n, reason } }; }
  const n = num(c.Adjust); if (n === null || !Number.isInteger(n) || n === 0 || Math.abs(n) > 1_000_000) return { ok: false, error: "Adjust must be a non-zero whole number like +20 or -3" };
  return { ok: true, value: { sku, mode: n > 0 ? "add" : "remove", qty: Math.abs(n), reason } };
}

/* ---------- import engine ---------- */
export interface ImportReport {
  dataset: Dataset; commit: boolean; totalRows: number; valid: number; created: number; updated: number; skipped: number;
  errors: { row: number; key?: string; message: string }[]; warnings: string[]; changes: string[];
}
const emptyReport = (dataset: Dataset, commit: boolean): ImportReport => ({ dataset, commit, totalRows: 0, valid: 0, created: 0, updated: 0, skipped: 0, errors: [], warnings: [], changes: [] });
const note = (r: ImportReport, s: string) => { if (r.changes.length < 60) r.changes.push(s); };

export async function importDataset(dataset: Dataset, file: Buffer, opts: { commit: boolean; mode?: "upsert" | "skip_existing" }): Promise<ImportReport> {
  if (!IMPORTABLE.includes(dataset)) throw new ApiError(400, dataset === "orders" || dataset === "reports" ? "Orders and reports can be exported but not imported (importing would bypass stock, payment and finance rules)." : "This dataset cannot be imported");
  let sheets; try { sheets = parseXlsx(file); } catch (e) { if (e instanceof XlsxError) throw new ApiError(400, e.message); throw e; }
  const known = COLUMNS[dataset as "products" | "inventory" | "customers"]; const required = dataset === "customers" ? ["Phone", "Name"] : ["SKU"];
  const { data, missing, ignored } = readTable(sheets[0].rows, known, required);
  if (missing.length) throw new ApiError(400, `The first sheet is missing the column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Download the template to see the expected columns.`);
  if (data.length > MAX_IMPORT_ROWS) throw new ApiError(400, `Too many rows (${data.length}). Import at most ${MAX_IMPORT_ROWS} rows at a time.`);
  const rep = emptyReport(dataset, opts.commit); rep.totalRows = data.length;
  if (ignored.length) rep.warnings.push(`Ignored unknown column${ignored.length > 1 ? "s" : ""}: ${ignored.join(", ")}`);
  if (!data.length) { rep.warnings.push("The sheet has no data rows."); return rep; }
  const seen = new Map<string, number>(); const dupCheck = (key: string, row: number) => { const first = seen.get(key); if (first) { rep.errors.push({ row, key, message: `Duplicate of row ${first} in this file` }); return true; } seen.set(key, row); return false; };
  if (dataset === "products") await importProducts(data, rep, opts, dupCheck); else if (dataset === "inventory") await importInventory(data, rep, opts, dupCheck); else await importCustomers(data, rep, opts, dupCheck);
  rep.errors.sort((a, b) => a.row - b.row); return rep;
}
type Rows = { row: number; cells: Record<string, string> }[]; type Dup = (key: string, row: number) => boolean;
type Opts = { commit: boolean; mode?: "upsert" | "skip_existing" };

async function importProducts(rows: Rows, rep: ImportReport, opts: Opts, dup: Dup) {
  const [cats, products] = await Promise.all([db.list<Category>("categories"), db.list<Product>("products")]);
  const bySku = new Map(products.filter((p) => p.sku).map((p) => [p.sku!.toUpperCase(), p]));
  for (const { row, cells } of rows) {
    const sku = cells.SKU.toUpperCase(); if (sku && dup(sku, row)) continue;
    const prev = bySku.get(sku); const r = parseProductRow(cells, cats, !prev);
    if (!r.ok) { rep.errors.push({ row, key: sku, message: r.error }); continue; }
    if (prev && opts.mode === "skip_existing") { rep.skipped++; continue; }
    if (prev && r.value.price !== undefined && r.value.oldPrice === undefined && prev.oldPrice && prev.oldPrice < r.value.price) rep.warnings.push(`Row ${row}: new Price is above the stored Old Price — the discount will disappear.`);
    if (prev?.variants?.length && (r.value.price !== undefined || r.value.oldPrice !== undefined)) rep.warnings.push(`Row ${row}: ${sku} has size / weight / colour options, so its price comes from the options and the Price column is ignored.`);
    rep.valid++; prev ? rep.updated++ : rep.created++;
    note(rep, `${prev ? "Update" : "Create"} ${sku} — ${r.value.name ?? prev?.name}${r.value.price !== undefined ? ` (price ${prev && prev.price !== r.value.price ? prev.price + " → " : ""}${r.value.price})` : ""}`);
    if (!opts.commit) continue;
    try {
      const v = r.value;
      const merged = {
        name: v.name ?? prev?.name, slug: prev?.slug, sku, description: v.description ?? prev?.description ?? "", price: v.price ?? prev?.price, oldPrice: v.oldPrice !== undefined ? v.oldPrice : prev?.oldPrice, unit: v.unit ?? prev?.unit ?? "1 pc",
        emoji: prev?.emoji ?? "🛒", image: v.image ?? prev?.image, images: prev?.images ?? (v.image ? [v.image] : []), genericName: prev?.genericName, manufacturer: prev?.manufacturer, prescriptionRequired: prev?.prescriptionRequired ?? false,
        categoryId: v.categoryId ?? prev?.categoryId, stock: prev ? prev.stock : v.stock ?? 0, rating: prev?.rating ?? 0, featured: v.featured ?? prev?.featured ?? false, active: v.active ?? prev?.active ?? true,
        offerStartsAt: v.offerStartsAt ?? prev?.offerStartsAt, offerEndsAt: v.offerEndsAt ?? prev?.offerEndsAt,
        variants: prev?.variants ?? [], // size / weight / colour options are edited in Admin → Products; an import must never wipe them
      };
      const data = productSchema.parse(merged) as any; const id = prev?.id ?? newId();
      const rec = { ...(await productCfg.prepare(data, prev ?? null, id)), id, offerStartsAt: merged.offerStartsAt || undefined, offerEndsAt: merged.offerEndsAt || undefined } as Product;
      await db.put("products", rec); bySku.set(sku, rec);
    } catch (e: any) { rep.valid--; prev ? rep.updated-- : rep.created--; rep.errors.push({ row, key: sku, message: e?.issues?.[0]?.message ?? e?.message ?? "Could not save this product" }); }
  }
}

async function importInventory(rows: Rows, rep: ImportReport, opts: Opts, dup: Dup) {
  const products = await db.list<Product>("products"); const bySku = new Map(products.filter((p) => p.sku).map((p) => [p.sku!.toUpperCase(), p]));
  for (const { row, cells } of rows) {
    const sku = cells.SKU.toUpperCase(); if (sku && dup(sku, row)) continue;
    const r = parseInventoryRow(cells); if (!r.ok) { rep.errors.push({ row, key: sku, message: r.error }); continue; }
    const p = bySku.get(sku); if (!p) { rep.errors.push({ row, key: sku, message: `No product with SKU ${sku}` }); continue; }
    const after = Math.max(0, r.value.mode === "set" ? r.value.qty : r.value.mode === "add" ? p.stock + r.value.qty : p.stock - r.value.qty);
    rep.valid++; rep.updated++; note(rep, `${sku} — ${p.name}: stock ${p.stock} → ${after}`);
    if (opts.commit) { try { await adjustStock(p.id, r.value.mode, r.value.qty, r.value.reason); } catch (e: any) { rep.valid--; rep.updated--; rep.errors.push({ row, key: sku, message: e?.message ?? "Could not update stock" }); } }
  }
}

async function importCustomers(rows: Rows, rep: ImportReport, opts: Opts, dup: Dup) {
  for (const { row, cells } of rows) {
    const { value, errors } = parseCustomerInput({ phone: cells.Phone, name: cells.Name, whatsapp: cells.WhatsApp, email: cells.Email, address: cells.Address, area: cells.Area, status: cells.Status || undefined, segmentOverride: cells.Segment || undefined, notes: cells.Notes }, true);
    const key = value.phone ?? cells.Phone; if (Object.keys(errors).length) { rep.errors.push({ row, key, message: Object.values(errors)[0] }); continue; }
    if (dup(value.phone!, row)) continue;
    const exists = await db.get<Customer>("customers", value.phone!);
    if (exists && opts.mode === "skip_existing") { rep.skipped++; continue; }
    rep.valid++; exists ? rep.updated++ : rep.created++; note(rep, `${exists ? "Update" : "Create"} ${value.phone} — ${value.name}`);
    if (opts.commit) { try { await upsertCustomerFromImport({ phone: cells.Phone, name: cells.Name, whatsapp: cells.WhatsApp, email: cells.Email, address: cells.Address, area: cells.Area, status: cells.Status || undefined, segmentOverride: cells.Segment || undefined, notes: cells.Notes }); } catch (e: any) { rep.valid--; exists ? rep.updated-- : rep.created--; rep.errors.push({ row, key, message: e?.message ?? "Could not save this customer" }); } }
  }
}

/* ---------- export ---------- */
export interface ExportOpts { template?: boolean; from?: string; to?: string; status?: string }
const DHAKA = 6 * 3600_000; const dayKey = (t: string | number) => new Date(new Date(t).getTime() + DHAKA).toISOString().slice(0, 10);
const sheet = (name: string, headers: readonly string[], rows: Cell[][], widths?: number[]): SheetIn => ({ name, headers: [...headers], rows, widths });
const helpSheet = (ds: string): SheetIn | null => (HELP[ds] ? sheet("Instructions", ["Column", "Rule"], HELP[ds], [26, 100]) : null);

export async function exportDataset(ds: Dataset, o: ExportOpts = {}): Promise<{ filename: string; buffer: Buffer }> {
  const stamp = new Date().toISOString().slice(0, 10); const sheets: SheetIn[] = [];
  if (ds === "products") {
    const [products, cats] = await Promise.all([db.list<Product>("products"), db.list<Category>("categories")]); const cn = new Map(cats.map((c) => [c.id, c.name]));
    sheets.push(sheet("Products", COLUMNS.products, o.template ? [] : products.sort((a, b) => (a.sku ?? "").localeCompare(b.sku ?? "")).map((p) => [p.sku ?? "", p.name, cn.get(p.categoryId) ?? "", p.price, p.oldPrice ?? "", p.unit, p.stock, p.active, p.featured, p.offerStartsAt ?? "", p.offerEndsAt ?? "", p.description, p.image ?? ""]), [16, 34, 20, 10, 10, 12, 8, 8, 9, 13, 13, 40, 30]));
  } else if (ds === "inventory") {
    const [products, cats] = await Promise.all([db.list<Product>("products"), db.list<Category>("categories")]); const cn = new Map(cats.map((c) => [c.id, c.name]));
    sheets.push(sheet("Inventory", COLUMNS.inventory, o.template ? [] : products.sort((a, b) => (a.sku ?? "").localeCompare(b.sku ?? "")).map((p) => [p.sku ?? "", p.name, cn.get(p.categoryId) ?? "", p.stock, "", "", p.unit, p.stock <= 0 ? "Out of stock" : p.stock <= 10 ? "Low" : "OK"]), [16, 34, 20, 8, 8, 24, 12, 12]));
  } else if (ds === "customers") {
    const list = o.template ? [] : filterCustomers(await db.list<Customer>("customers"), {});
    sheets.push(sheet("Customers", COLUMNS.customers, list.map((c) => [c.phone, c.name, c.whatsapp ?? "", c.email ?? "", c.address ?? "", c.area ?? "", c.status, c.segment, c.notes ?? "", c.orderCount, c.totalSpent, c.lastOrderAt?.slice(0, 10) ?? ""]), [14, 24, 14, 24, 40, 16, 10, 10, 40, 8, 12, 12]));
  } else if (ds === "orders") {
    let list = o.template ? [] : await db.list<Order>("orders");
    if (o.status) list = list.filter((x) => x.status === o.status); if (o.from) list = list.filter((x) => dayKey(x.createdAt) >= o.from!); if (o.to) list = list.filter((x) => dayKey(x.createdAt) <= o.to!);
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    sheets.push(sheet("Orders", COLUMNS.orders, list.map((x) => [x.orderNo, dayKey(x.createdAt), x.status, x.name, x.phone, x.address, x.zoneName ?? "", x.items.map((i) => `${i.qty}× ${i.name}`).join("; "), x.subtotal, x.discount, x.delivery, x.serviceCharge ?? 0, x.total, x.paymentLabel || x.payment, x.paymentStatus ?? "", x.paymentRef ?? "", x.riderName ?? "", x.courierName ?? "", x.trackingNo ?? "", x.note]), [14, 12, 12, 22, 14, 40, 16, 50, 10, 10, 10, 10, 10, 14, 12, 14, 16, 14, 16, 30]));
  } else {
    const [orders, products, customers] = await Promise.all([db.list<Order>("orders"), db.list<Product>("products"), db.list<Customer>("customers")]);
    const to = o.to || dayKey(Date.now()); const from = o.from || dayKey(Date.now() - 29 * 86_400_000);
    const inRange = orders.filter((x) => dayKey(x.createdAt) >= from && dayKey(x.createdAt) <= to); const live = inRange.filter((x) => x.status !== "cancelled" && x.status !== "returned");
    const sum = (a: Order[]) => a.reduce((n, x) => n + x.total, 0);
    sheets.push(sheet("Summary", ["Metric", "Value"], [["Period", `${from} to ${to}`], ["Orders (all)", inRange.length], ["Orders (excluding cancelled/returned)", live.length], ["Sales (excluding cancelled/returned)", sum(live)], ["Delivered revenue", sum(live.filter((x) => x.status === "delivered"))], ["Average order value", live.length ? Math.round(sum(live) / live.length) : 0], ["Cancelled", inRange.filter((x) => x.status === "cancelled").length], ["Returned", inRange.filter((x) => x.status === "returned").length], ["Customers", customers.length]], [40, 24]));
    const days = new Map<string, { n: number; s: number }>(); for (const x of live) { const d = days.get(dayKey(x.createdAt)) ?? { n: 0, s: 0 }; d.n++; d.s += x.total; days.set(dayKey(x.createdAt), d); }
    sheets.push(sheet("Sales by Day", ["Date", "Orders", "Sales"], [...days].sort().map(([d, v]) => [d, v.n, v.s]), [14, 10, 14]));
    const top = new Map<string, { name: string; q: number; r: number }>(); for (const x of live) for (const i of x.items) { const t = top.get(i.id) ?? { name: i.name, q: 0, r: 0 }; t.q += i.qty; t.r += i.qty * i.price; top.set(i.id, t); }
    sheets.push(sheet("Top Products", ["Product", "Units sold", "Revenue"], [...top.values()].sort((a, b) => b.q - a.q).slice(0, 50).map((t) => [t.name, t.q, t.r]), [40, 12, 14]));
    const pay = new Map<string, { n: number; s: number }>(); for (const x of live) { const k = x.paymentLabel || x.payment; const d = pay.get(k) ?? { n: 0, s: 0 }; d.n++; d.s += x.total; pay.set(k, d); }
    sheets.push(sheet("By Payment Method", ["Method", "Orders", "Sales"], [...pay].map(([k, v]) => [k, v.n, v.s]), [22, 10, 14]));
    sheets.push(sheet("Low Stock", ["SKU", "Product", "Stock", "Unit"], products.filter((p) => p.active && p.stock <= 10).sort((a, b) => a.stock - b.stock).map((p) => [p.sku ?? "", p.name, p.stock, p.unit]), [16, 40, 8, 12]));
    const seg = new Map<string, number>(); for (const c of customers) { const s = present(c).segment; seg.set(s, (seg.get(s) ?? 0) + 1); }
    sheets.push(sheet("Customer Segments", ["Segment", "Customers"], [...seg], [16, 12]));
  }
  if (o.template) { const h = helpSheet(ds); if (h) sheets.push(h); }
  return { filename: `daffomart-${ds}${o.template ? "-template" : ""}-${stamp}.xlsx`, buffer: buildXlsx(sheets) };
}
