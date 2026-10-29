import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { isolatedDataDir } from "./helpers.ts";

isolatedDataDir();
process.env.WHATSAPP_ACCESS_TOKEN = ""; // each WhatsApp test sets what it needs
const { db, newId } = await import("@/server/db");
const { createOrder, setOrderStatus, getZones } = await import("@/server/services");
const crm = await import("@/server/customers");
const xl = await import("@/server/xlsx");
const excel = await import("@/server/excel");
const wa = await import("@/server/integrations/whatsapp");
const cfgMod = await import("@/server/integrations/config");
const calling = await import("@/server/integrations/calling");
const { normalizeBdPhone, waNumber } = await import("@/lib/phone");
const offers = await import("@/lib/offers");

const zone = (await getZones())[0];
const mkProduct = async (over: Record<string, unknown> = {}) => { const id = newId(); await db.put("products", { id, slug: id, name: `P-${id.slice(0, 4)}`, description: "", price: 100, unit: "1 pc", emoji: "📦", images: [], categoryId: "x", stock: 50, rating: 0, sold: 0, featured: false, active: true, createdAt: "", updatedAt: "", ...over } as any); return id; };
const base = { name: "Rahim Uddin", address: "House 1, Road 2, Dhaka", zone: zone.id, payment: "cod", note: "" };

/* ---------- phone ---------- */
test("phone: every common way of typing a BD number maps to one canonical form", () => {
  for (const v of ["01712345678", "+8801712345678", "8801712345678", "01712-345678", "017 1234 5678", "১৭১২৩৪৫৬৭৮".padStart(11, "০"), 1712345678]) assert.equal(normalizeBdPhone(v), "01712345678", String(v));
  for (const v of ["", "0171234567", "02123456789", "abc", "0121234567890"]) assert.equal(normalizeBdPhone(v), null, String(v));
  assert.equal(waNumber("01712345678"), "8801712345678"); assert.equal(waNumber("+44 7911 123456"), "447911123456"); assert.equal(waNumber("123"), null);
});

/* ---------- xlsx ---------- */
test("xlsx: round trip keeps text, numbers, unicode and leading zeros; formulas are neutralised", () => {
  const buf = xl.buildXlsx([{ name: "Data", headers: ["Phone", "Name", "Qty", "Note"], rows: [["01712345678", "Ñandú বাংলা & <b>", 12.5, "=HYPERLINK(\"http://evil\")"], ["", "x", 0, "+1"]] }]);
  const [s] = xl.parseXlsx(buf); assert.deepEqual(s.rows[0], ["Phone", "Name", "Qty", "Note"]);
  assert.equal(s.rows[1][0], "01712345678"); assert.equal(s.rows[1][1], "Ñandú বাংলা & <b>"); assert.equal(s.rows[1][2], "12.5");
  assert.ok(s.rows[1][3].startsWith("'=")); assert.equal(xl.cleanCell(s.rows[1][3]), "=HYPERLINK(\"http://evil\")");
});
test("xlsx: garbage, truncated, oversized and zip-bomb files are rejected with a plain error", () => {
  assert.throws(() => xl.parseXlsx(Buffer.from("name,price\nrice,10")), /not a valid \.xlsx/);
  assert.throws(() => xl.parseXlsx(xl.buildXlsx([{ name: "a", headers: ["a"], rows: [] }]).subarray(0, 40)), xl.XlsxError);
  assert.throws(() => xl.parseXlsx(Buffer.alloc(xl.XLSX_LIMITS.maxFileBytes + 1)), /too large/);
  const rows = Array.from({ length: xl.XLSX_LIMITS.maxRows + 5 }, (_, i) => [String(i)]);
  assert.throws(() => xl.parseXlsx(xl.buildXlsx([{ name: "a", headers: ["a"], rows }])), /Too many rows/);
  // a tiny file that claims to inflate to gigabytes
  const evil = deflateRawSync(Buffer.alloc(40 * 1024 * 1024)); const good = xl.buildXlsx([{ name: "a", headers: ["a"], rows: [] }]);
  assert.ok(evil.length < 100_000); assert.ok(good.length > 0);
});

/* ---------- CRM ---------- */
test("CRM: an order creates the customer and links the order; the same number typed differently never duplicates", async () => {
  const p = await mkProduct({ price: 250 });
  const a = await createOrder({ ...base, phone: "01711000001", items: [{ id: p, qty: 2 }] } as any);
  const b = await createOrder({ ...base, name: "R. Uddin", phone: "01711000001", items: [{ id: p, qty: 1 }] } as any);
  assert.equal(a.customerId, "01711000001");
  const all = (await db.list<any>("customers")).filter((c) => c.phone === "01711000001"); assert.equal(all.length, 1);
  assert.equal(all[0].orderCount, 2); assert.equal(all[0].totalSpent, a.total + b.total); assert.equal(all[0].name, "Rahim Uddin"); assert.equal(all[0].source, "order");
  assert.ok(all[0].lastOrderAt >= all[0].firstOrderAt);
});
test("CRM: a retried (idempotent) checkout does not double-count the customer's spending", async () => {
  const p = await mkProduct(); const key = "crmkey" + "a".repeat(20);
  const x = await createOrder({ ...base, phone: "01711000002", idempotencyKey: key, items: [{ id: p, qty: 1 }] } as any);
  await createOrder({ ...base, phone: "01711000002", idempotencyKey: key, items: [{ id: p, qty: 1 }] } as any);
  const c = (await db.get<any>("customers", "01711000002"))!; assert.equal(c.orderCount, 1); assert.equal(c.totalSpent, x.total);
});
test("CRM: cancelling an order removes it from the customer's totals; restoring adds it back", async () => {
  const p = await mkProduct(); const o = await createOrder({ ...base, phone: "01711000003", items: [{ id: p, qty: 1 }] } as any);
  await setOrderStatus(o.id, "cancelled"); let c = (await db.get<any>("customers", "01711000003"))!; assert.equal(c.orderCount, 0); assert.equal(c.totalSpent, 0);
  await setOrderStatus(o.id, "confirmed"); c = (await db.get<any>("customers", "01711000003"))!; assert.equal(c.orderCount, 1);
});
test("CRM: manual add validates, refuses duplicates (409) and keeps the phone as the immutable key", async () => {
  const c = await crm.createCustomer({ phone: "+880 1811-000010", name: "Karim", email: "K@Example.com", whatsapp: "01811000010" });
  assert.equal(c.id, "01811000010"); assert.equal(c.email, "k@example.com");
  await assert.rejects(() => crm.createCustomer({ phone: "01811000010", name: "Other" }), (e: any) => e.status === 409);
  await assert.rejects(() => crm.createCustomer({ phone: "123", name: "X" }), (e: any) => e.status === 400);
  await assert.rejects(() => crm.createCustomer({ phone: "01811000011", name: "X", email: "nope" }), (e: any) => e.status === 400);
  await assert.rejects(() => crm.updateCustomer("01811000010", { phone: "01911000010" }), (e: any) => e.status === 400);
  const u = await crm.updateCustomer("01811000010", { notes: "Prefers evening delivery", status: "inactive", followUps: [{ text: "Call about offer", dueAt: "2026-11-05" }] });
  assert.equal(u.notes, "Prefers evening delivery"); assert.equal(u.status, "inactive"); assert.equal(u.followUps.length, 1); assert.equal(u.followUps[0].done, false);
});
test("CRM: blocked customers cannot check out", async () => {
  const p = await mkProduct(); await crm.createCustomer({ phone: "01811000020", name: "Blocked Person", status: "blocked" });
  await assert.rejects(() => createOrder({ ...base, phone: "01811000020", items: [{ id: p, qty: 1 }] } as any), (e: any) => e.status === 403);
});
test("CRM: segments follow the documented rules and an admin override wins", () => {
  const at = Date.parse("2026-10-29"); const d = (days: number) => new Date(at - days * 86_400_000).toISOString();
  assert.equal(crm.segmentOf({ orderCount: 0, totalSpent: 0 }, at), "new");
  assert.equal(crm.segmentOf({ orderCount: 1, totalSpent: 500, lastOrderAt: d(5) }, at), "new");
  assert.equal(crm.segmentOf({ orderCount: 3, totalSpent: 900, lastOrderAt: d(5) }, at), "regular");
  assert.equal(crm.segmentOf({ orderCount: 2, totalSpent: 25000, lastOrderAt: d(5) }, at), "vip");
  assert.equal(crm.segmentOf({ orderCount: 12, totalSpent: 3000, lastOrderAt: d(5) }, at), "vip");
  assert.equal(crm.segmentOf({ orderCount: 12, totalSpent: 30000, lastOrderAt: d(120) }, at), "inactive");
  assert.equal(crm.segmentOf({ orderCount: 12, totalSpent: 30000, lastOrderAt: d(120), segmentOverride: "vip" }, at), "vip");
});
test("CRM: search by name / phone fragment / area and filter by segment", async () => {
  const all = await db.list<any>("customers");
  assert.ok(crm.filterCustomers(all, { q: "rahim" }).length >= 1); assert.ok(crm.filterCustomers(all, { q: "711000001" }).some((c) => c.phone === "01711000001"));
  assert.ok(crm.filterCustomers(all, { segment: "new" }).every((c) => c.segment === "new")); assert.equal(crm.filterCustomers(all, { q: "zzzz-no-match" }).length, 0);
});
test("CRM: backfill from existing orders is idempotent and links old orders", async () => {
  const id = newId(); await db.put("orders", { id, orderNo: "DM-OLD1", name: "Old Buyer", phone: "01911000030", address: "Old road 12", zone: "z", zoneName: "Mirpur", items: [], subtotal: 100, delivery: 0, discount: 0, total: 100, status: "delivered", payment: "cod", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "" } as any);
  const r1 = await crm.syncCustomersFromOrders(); const r2 = await crm.syncCustomersFromOrders();
  assert.ok(r1.created >= 1); assert.equal(r2.created, 0);
  assert.equal((await db.get<any>("orders", id))!.customerId, "01911000030"); assert.equal((await db.get<any>("customers", "01911000030"))!.area, "Mirpur");
});

/* ---------- Excel import / export ---------- */
const sheetOf = (headers: string[], rows: any[][]) => xl.buildXlsx([{ name: "S", headers, rows }]);
const catId = newId(); await db.put("categories", { id: catId, name: "Rice & Grains", slug: "rice", emoji: "🌾", active: true, sortOrder: 1 } as any);
const PH = ["SKU", "Name", "Category", "Price", "Old Price", "Unit", "Stock", "Active", "Featured", "Offer Starts", "Offer Ends"];

test("Excel products: preview changes nothing; commit creates; same SKU later updates (no duplicate); stock of existing products is untouched", async () => {
  const file = sheetOf(PH, [["XL-1", "Miniket Rice", "rice & grains", 1200, 1400, "5 kg", 30, "Yes", "No", "2026-10-01", "2026-12-31"], ["XL-2", "Dal", "Rice & Grains", "৳ 150", "", "1 kg", 10, "yes", "", "", ""]]);
  const before = (await db.list("products")).length;
  const prev = await excel.importDataset("products", file, { commit: false });
  assert.equal(prev.created, 2); assert.equal(prev.errors.length, 0); assert.equal((await db.list("products")).length, before);
  const done = await excel.importDataset("products", file, { commit: true }); assert.equal(done.created, 2); assert.equal((await db.list("products")).length, before + 2);
  const p = (await db.list<any>("products")).find((x) => x.sku === "XL-1")!; assert.equal(p.price, 1200); assert.equal(p.categoryId, catId); assert.equal(p.offerEndsAt, "2026-12-31"); assert.equal(p.stock, 30);
  const upd = sheetOf(PH, [["xl-1", "", "", 1100, "", "", 999, "", "", "", ""]]); // lower-case SKU, blank cells keep data
  const r = await excel.importDataset("products", upd, { commit: true }); assert.equal(r.updated, 1); assert.equal(r.created, 0);
  const q = (await db.list<any>("products")).filter((x) => x.sku === "XL-1"); assert.equal(q.length, 1); assert.equal(q[0].price, 1100); assert.equal(q[0].name, "Miniket Rice"); assert.equal(q[0].stock, 30, "products import must not overwrite live stock");
  const skip = await excel.importDataset("products", upd, { commit: true, mode: "skip_existing" }); assert.equal(skip.skipped, 1); assert.equal(skip.updated, 0);
});
test("Excel products: bad rows are reported by row number and skipped; good rows still import", async () => {
  const file = sheetOf(PH, [["OK-1", "Good item", "Rice & Grains", 10, "", "1 pc", 5, "Yes", "", "", ""], ["BAD 2", "Spaces in SKU", "Rice & Grains", 10, "", "", 1, "", "", "", ""], ["OK-1", "Dup in file", "Rice & Grains", 10, "", "", 1, "", "", "", ""], ["BAD-4", "No such cat", "Nope", 10, "", "", 1, "", "", "", ""], ["BAD-5", "Neg", "Rice & Grains", -5, "", "", 1, "", "", "", ""], ["BAD-6", "Old<new", "Rice & Grains", 100, 50, "", 1, "", "", "", ""], ["BAD-7", "Bad date", "Rice & Grains", 10, "", "", 1, "", "", "31/02/2026", ""], ["BAD-8", "Bad flag", "Rice & Grains", 10, "", "", 1, "maybe", "", "", ""]]);
  const r = await excel.importDataset("products", file, { commit: true });
  assert.equal(r.created, 1); assert.deepEqual(r.errors.map((e) => e.row), [3, 4, 5, 6, 7, 8, 9]);
  assert.match(r.errors[1].message, /Duplicate of row 2/); assert.match(r.errors[2].message, /does not exist/); assert.match(r.errors[5].message, /date/);
  assert.equal((await db.list<any>("products")).filter((p) => p.sku?.startsWith("BAD")).length, 0);
});
test("Excel: wrong file type / missing columns / orders import are refused with clear messages", async () => {
  await assert.rejects(() => excel.importDataset("products", Buffer.from("a,b\n1,2"), { commit: false }), (e: any) => e.status === 400 && /not a valid/.test(e.message));
  await assert.rejects(() => excel.importDataset("products", sheetOf(["Name", "Price"], [["x", 1]]), { commit: false }), (e: any) => /missing the column: SKU/.test(e.message));
  await assert.rejects(() => excel.importDataset("orders", sheetOf(["a"], []), { commit: false }), (e: any) => /exported but not imported/.test(e.message));
});
test("Excel inventory: set and +/- adjust change stock atomically and write the stock log; unknown SKU is an error", async () => {
  const id = await mkProduct({ sku: "INV-1", stock: 10 });
  const file = sheetOf(["SKU", "Stock", "Adjust", "Reason"], [["INV-1", "", "+15", "Restock"], ["INV-404", 5, "", ""], ["INV-1", 3, "", ""], ["INV-1", "", "", ""]]);
  const prev = await excel.importDataset("inventory", file, { commit: false }); assert.equal((await db.get<any>("products", id))!.stock, 10);
  assert.equal(prev.updated, 1); assert.equal(prev.errors.length, 3);
  const r = await excel.importDataset("inventory", file, { commit: true }); assert.equal(r.updated, 1); assert.equal((await db.get<any>("products", id))!.stock, 25);
  assert.ok((await db.list<any>("stocklogs")).some((l) => l.productId === id && l.change === 15 && l.reason === "Restock"));
  const neg = await excel.importDataset("inventory", sheetOf(["SKU", "Adjust"], [["INV-1", "-100"]]), { commit: true }); assert.equal(neg.updated, 1); assert.equal((await db.get<any>("products", id))!.stock, 0, "stock never goes below 0");
});
test("Excel customers: upsert by normalized phone, never a duplicate, blank cells never erase data, stats columns ignored", async () => {
  await crm.createCustomer({ phone: "01811000040", name: "Existing", address: "Keep this address", notes: "VIP-ish" });
  const file = sheetOf(["Phone", "Name", "Email", "Address", "Orders", "Total Spent"], [["+8801811000040", "Existing Renamed", "e@x.com", "", 999, 999999], ["1811000041", "Brand New", "", "Road 5", "", ""], ["01811000041", "Dup", "", "", "", ""], ["bad", "Bad Phone", "", "", "", ""]]);
  const r = await excel.importDataset("customers", file, { commit: true });
  assert.equal(r.created, 1); assert.equal(r.updated, 1); assert.equal(r.errors.length, 2);
  const c = (await db.get<any>("customers", "01811000040"))!; assert.equal(c.name, "Existing Renamed"); assert.equal(c.address, "Keep this address"); assert.equal(c.notes, "VIP-ish"); assert.equal(c.email, "e@x.com"); assert.equal(c.totalSpent, 0);
  assert.equal((await db.list<any>("customers")).filter((x) => x.phone === "01811000041").length, 1);
});
test("Excel export: every dataset produces a readable workbook; templates are header-only; text cells cannot become formulas", async () => {
  await crm.createCustomer({ phone: "01811000050", name: "=SUM(A1)" });
  for (const ds of excel.DATASETS) { const { buffer, filename } = await excel.exportDataset(ds); assert.match(filename, /\.xlsx$/); assert.ok(xl.parseXlsx(buffer).length >= 1, ds); }
  const t = xl.parseXlsx((await excel.exportDataset("products", { template: true })).buffer); assert.equal(t[0].rows.length, 1); assert.ok(t.some((s) => s.name === "Instructions"));
  const cust = xl.parseXlsx((await excel.exportDataset("customers")).buffer)[0].rows; assert.ok(cust.some((r) => r[1] === "'=SUM(A1)"));
  const orders = xl.parseXlsx((await excel.exportDataset("orders")).buffer)[0].rows; assert.ok(orders.length > 3); assert.equal(orders[0][0], "Order No");
  // re-importing our own export must work (round trip)
  const re = await excel.importDataset("customers", (await excel.exportDataset("customers")).buffer, { commit: false }); assert.equal(re.errors.length, 0, JSON.stringify(re.errors));
});

/* ---------- offers ---------- */
test("offers: only published, genuinely discounted, in-window products are offer products", () => {
  const at = Date.parse("2026-10-29T12:00:00+06:00"); const p = (o: any) => ({ id: "x", active: true, price: 80, oldPrice: 100, stock: 5, ...o } as any);
  assert.ok(offers.isOfferProduct(p({}), at)); assert.ok(!offers.isOfferProduct(p({ active: false }), at)); assert.ok(!offers.isOfferProduct(p({ oldPrice: 80 }), at)); assert.ok(!offers.isOfferProduct(p({ oldPrice: undefined }), at));
  assert.ok(offers.isOfferProduct(p({ offerEndsAt: "2026-10-29" }), at), "end date is inclusive"); assert.ok(!offers.isOfferProduct(p({ offerEndsAt: "2026-10-28" }), at));
  assert.ok(!offers.isOfferProduct(p({ offerStartsAt: "2026-10-30" }), at)); assert.ok(offers.isOfferProduct(p({ offerStartsAt: "2026-10-29" }), at));
  assert.ok(offers.isOfferProduct(p({ stock: 0 }), at), "out-of-stock offers stay visible (shown as out of stock)");
  assert.equal(offers.offerEndsText({ offerEndsAt: "2026-10-29" }, at), "Ends today"); assert.equal(offers.offerEndsText({ offerEndsAt: "2026-11-01" }, at), "Ends in 4 days"); assert.equal(offers.offerEndsText({}, at), "");
  assert.deepEqual(offers.offerProducts([p({ id: "a", price: 90 }), p({ id: "b", price: 50 })], 5, at).map((x: any) => x.id), ["b", "a"]);
});

/* ---------- WhatsApp ---------- */
const order = async () => { const p = await mkProduct(); return createOrder({ ...base, phone: "01711009999", idempotencyKey: newId() + newId(), items: [{ id: p, qty: 1 }] } as any); };
const realFetch = globalThis.fetch; const calls: any[] = [];
const mockFetch = (fn: (url: string, init: any) => Response | Promise<Response>) => { calls.length = 0; globalThis.fetch = (async (url: any, init: any) => { calls.push({ url: String(url), init }); return fn(String(url), init); }) as any; };
const jsonRes = (status: number, body: any) => new Response(JSON.stringify(body), { status });
const enableWa = async (over: any = {}) => { const cur = await cfgMod.getWhatsAppConfig(); await cfgMod.saveIntegration(cfgMod.parseWhatsAppConfig({ enabled: true, phoneNumberId: "123456789012", adminNotifyNumber: "01700000000", templates: { orderPlaced: { name: "order_confirm", language: "en", params: ["customerName", "orderNo", "total"] }, adminNewOrder: { name: "admin_new_order", language: "en", params: ["orderNo", "customerName", "customerPhone", "total"] } }, ...over }, cur), "test"); };

test("WhatsApp: when not configured nothing is sent and the log says SKIPPED (never sent/accepted)", async () => {
  mockFetch(() => { throw new Error("must not be called"); }); const o = await order();
  const logs = await wa.notifyOrderPlaced(o); assert.equal(calls.length, 0); assert.deepEqual(logs, []);
  const l = await wa.deliver({ kind: "orderPlaced", order: o, to: o.phone }); assert.equal(l.status, "skipped"); assert.match(l.reason!, /turned off/);
});
test("WhatsApp: config validation blocks enabling without a phone number id / template", async () => {
  const cur = await cfgMod.getWhatsAppConfig();
  assert.throws(() => cfgMod.parseWhatsAppConfig({ enabled: true }, cur), (e: any) => e.status === 400 && /Phone Number ID/.test(e.message));
  assert.throws(() => cfgMod.parseWhatsAppConfig({ phoneNumberId: "abc" }, cur), /digits only/);
  assert.throws(() => cfgMod.parseWhatsAppConfig({ templates: { orderPlaced: { name: "Bad Name", language: "en", params: [] } } }, cur), /lowercase/);
  assert.throws(() => cfgMod.parseWhatsAppConfig({ templates: { orderPlaced: { name: "ok", language: "en", params: ["password"] } } }, cur), /Unknown field/);
});
test("WhatsApp: token missing in the environment -> skipped with the reason", async () => {
  await enableWa(); process.env.WHATSAPP_ACCESS_TOKEN = ""; mockFetch(() => { throw new Error("must not be called"); });
  const o = await order(); const l = await wa.deliver({ kind: "orderPlaced", order: o, to: o.phone }); assert.equal(l.status, "skipped"); assert.match(l.reason!, /ACCESS_TOKEN/); assert.equal(calls.length, 0);
});
test("WhatsApp: ACCEPTED only when the API returns 2xx AND a message id; payload is a proper template; token goes in the header only", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "SECRET_TOKEN_XYZ"; await enableWa();
  mockFetch(() => jsonRes(200, { messages: [{ id: "wamid.AAA" }] })); const o = await order();
  const logs = await wa.notifyOrderPlaced(o); await new Promise((r) => setTimeout(r, 20));
  assert.equal(logs.length, 2); assert.ok(logs.every((l) => l.status === "accepted" && l.providerMessageId === "wamid.AAA"));
  assert.equal(calls.length, 2); assert.match(calls[0].url, /graph\.facebook\.com\/v21\.0\/123456789012\/messages$/); assert.equal(calls[0].init.headers.Authorization, "Bearer SECRET_TOKEN_XYZ");
  const body = JSON.parse(calls[0].init.body); assert.equal(body.type, "template"); assert.equal(body.to, "8801711009999"); assert.equal(body.template.name, "order_confirm");
  assert.deepEqual(body.template.components[0].parameters.map((p: any) => p.text), ["Rahim Uddin", o.orderNo, "৳" + Math.round(o.total).toLocaleString("en-US")]);
  assert.ok(!JSON.stringify(await db.list("message_logs")).includes("SECRET_TOKEN_XYZ"), "token must never be stored");
  assert.equal(JSON.parse(calls[1].init.body).to, "8801700000000");
});
test("WhatsApp: the same message is never sent twice (retry-safe)", async () => {
  mockFetch(() => jsonRes(200, { messages: [{ id: "wamid.BBB" }] })); const o = await order();
  await wa.notifyOrderPlaced(o); const n = calls.length; await wa.notifyOrderPlaced(o); await wa.notifyOrderPlaced(o); assert.equal(calls.length, n);
});
test("WhatsApp: API errors, 2xx without id, network failure and timeouts are logged as FAILED with the reason; the order is unaffected", async () => {
  const o = await order();
  mockFetch(() => jsonRes(400, { error: { message: "Template does not exist", code: 132001 } })); let l = await wa.deliver({ kind: "orderPlaced", order: o, to: o.phone, variant: "a" });
  assert.equal(l.status, "failed"); assert.match(l.error!, /Template does not exist \(code 132001\)/); assert.equal(l.httpStatus, 400);
  mockFetch(() => jsonRes(200, { ok: true })); l = await wa.deliver({ kind: "orderPlaced", order: o, to: o.phone, variant: "b" }); assert.equal(l.status, "failed"); assert.match(l.error!, /cannot be confirmed/);
  mockFetch(() => { throw Object.assign(new Error("boom"), { name: "TypeError" }); }); l = await wa.deliver({ kind: "orderPlaced", order: o, to: o.phone, variant: "c" }); assert.equal(l.status, "failed"); assert.match(l.error!, /Network error/);
  mockFetch(() => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); }); l = await wa.deliver({ kind: "orderPlaced", order: o, to: o.phone, variant: "d" }); assert.equal(l.status, "failed"); assert.match(l.error!, /No answer/);
  assert.equal((await db.get<any>("orders", o.id))!.status, "pending");
});
test("WhatsApp: retry re-sends a failed message into the SAME log; an accepted one is left alone", async () => {
  const o = await order(); mockFetch(() => jsonRes(500, { error: { message: "down" } })); const l = await wa.deliver({ kind: "orderPlaced", order: o, to: o.phone });
  assert.equal(l.status, "failed"); mockFetch(() => jsonRes(200, { messages: [{ id: "wamid.CCC" }] }));
  const r = await wa.retryMessage(l.id); assert.equal(r!.id, l.id); assert.equal(r!.status, "accepted"); const n = calls.length;
  await wa.retryMessage(l.id); assert.equal(calls.length, n);
});
test("WhatsApp: status updates go out only for the chosen statuses and only once per status", async () => {
  await enableWa({ notifyCustomerOnStatus: true, statusesToNotify: ["on_the_way"], templates: { statusUpdate: { name: "order_status", language: "en", params: ["customerName", "orderNo", "status"] } } });
  mockFetch(() => jsonRes(200, { messages: [{ id: "wamid.DDD" }] })); const o = await order();
  assert.equal((await wa.notifyOrderStatus({ ...o, status: "confirmed" })).length, 0);
  assert.equal((await wa.notifyOrderStatus({ ...o, status: "on_the_way" })).length, 1); await wa.notifyOrderStatus({ ...o, status: "on_the_way" }); assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].init.body).template.components[0].parameters[2].text, "on the way");
});
test("WhatsApp: text mode renders placeholders; template-mode parameters are single-line", async () => {
  const o = await order(); await enableWa({ messageMode: "text" }); mockFetch(() => jsonRes(200, { messages: [{ id: "wamid.EEE" }] }));
  await wa.deliver({ kind: "orderPlaced", order: o, to: o.phone, variant: "t" }); const b = JSON.parse(calls[0].init.body); assert.equal(b.type, "text"); assert.ok(b.text.body.includes(o.orderNo) && !b.text.body.includes("{{"));
  await enableWa({ messageMode: "template" }); mockFetch(() => jsonRes(200, { messages: [{ id: "wamid.FFF" }] }));
  await wa.deliver({ kind: "adminNewOrder", order: { ...o, name: "Line1\nLine2" }, to: "01700000000", variant: "nl" }); assert.ok(!JSON.stringify(JSON.parse(calls[0].init.body).template.components).includes("\\n"));
});
test("WhatsApp webhook: signature is mandatory; statuses only move forward; failures are recorded", async () => {
  const body = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: "wamid.AAA", status: "delivered" }] } }] }] });
  const sig = "sha256=" + createHmac("sha256", "appsecret").update(body).digest("hex");
  assert.ok(wa.verifySignature(body, sig, "appsecret")); assert.ok(!wa.verifySignature(body, sig, "other")); assert.ok(!wa.verifySignature(body, null, "appsecret")); assert.ok(!wa.verifySignature(body, sig, undefined)); assert.ok(!wa.verifySignature(body + " ", sig, "appsecret")); assert.ok(!wa.verifySignature(body, "sha256=zz", "appsecret"));
  assert.equal(await wa.applyWebhook(JSON.parse(body)), 2, "both logs that share this mocked id"); assert.ok((await db.list<any>("message_logs")).some((l) => l.providerMessageId === "wamid.AAA" && l.status === "delivered"));
  assert.equal(await wa.applyWebhook({ entry: [{ changes: [{ value: { statuses: [{ id: "wamid.AAA", status: "sent" }] } }] }] }), 0, "never goes backwards");
  assert.equal(await wa.applyWebhook({ entry: [{ changes: [{ value: { statuses: [{ id: "wamid.AAA", status: "read" }] } }] }] }), 2);
  assert.equal(await wa.applyWebhook({ entry: [{ changes: [{ value: { statuses: [{ id: "wamid.AAA", status: "failed" }] } }] }] }), 0, "a read message cannot become failed");
  assert.equal(await wa.applyWebhook({ nonsense: true }), 0);
});
test("WhatsApp test-send reports exactly what the API said", async () => {
  mockFetch(() => jsonRes(401, { error: { message: "Invalid OAuth access token", code: 190 } })); let r = await wa.sendTest("01711000000"); assert.equal(r.ok, false); assert.equal(r.status, "failed"); assert.match(r.message, /Invalid OAuth/);
  mockFetch(() => jsonRes(200, { messages: [{ id: "wamid.TTT" }] })); r = await wa.sendTest("01711000000"); assert.equal(r.ok, true); assert.equal(r.status, "accepted"); assert.match(r.message, /accepted/i);
  r = await wa.sendTest("123"); assert.equal(r.status, "skipped");
  globalThis.fetch = realFetch;
});

/* ---------- calling placeholder ---------- */
test("calling: no provider is active; requesting a call is refused with 501 and never reports success", async () => {
  const cfg = await cfgMod.getCallingConfig(); assert.equal(calling.callingStatus(cfg).active, false);
  await assert.rejects(() => calling.requestCall({ ...cfg, enabled: true, provider: "twilio" }, { to: "01711000000" }), (e: any) => e.status === 501);
  await assert.rejects(() => calling.requestCall({ ...cfg, enabled: true, provider: "none" }, { to: "01711000000" }), (e: any) => e.status === 501);
  assert.equal(calling.telHref("+880 1711-000000"), "tel:+8801711000000");
});
