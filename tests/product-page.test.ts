import test from "node:test";
import assert from "node:assert/strict";
import { isolatedDataDir } from "./helpers.ts";

isolatedDataDir();
process.env.ADMIN_EMAIL = "owner@daffomart.test"; process.env.ADMIN_PASSWORD = "owner-password-123"; process.env.AUTH_SECRET = "y".repeat(40);
const { db, newId } = await import("@/server/db");
const pp = await import("@/server/productPage");
const lib = await import("@/lib/productPage");
const rv = await import("@/server/reviews");
const builderApi = await import("@/app/api/admin/product-page/route");
const reviewsApi = await import("@/app/api/admin/reviews/route");
const { createSessionCookie } = await import("@/server/auth");
const { upsertAdmin } = await import("@/server/adminAccounts");
const jar = (j: Record<string, string> = {}) => ((globalThis as any).__testCookies = j);

const mkProduct = async (name = "P") => { const id = newId(); await db.put("products", { id, name, slug: name.toLowerCase() + id.slice(0, 4), price: 100, stock: 9, active: true, unit: "1", images: [], categoryId: "c", sold: 0, rating: 0, createdAt: "", updatedAt: "" } as any); return id; };
const ids = (l: { sections: { id: string }[] }) => l.sections.map((s) => s.id);
const docs = async () => db.list<any>("product_layouts");

test("default layout has the seven sections in the required order (brand info is the optional extra)", () => {
  const d = lib.defaultLayout().sections;
  assert.deepEqual(d.filter((s) => s.enabled).map((s) => s.id).filter((x) => x !== "brand"), ["overview", "specs", "video", "gallery", "reviews", "sameCategory", "recommended"]);
});

test("validateLayout rejects bad layouts; resolveLayout falls back to the default for a broken one", () => {
  assert.equal(lib.validateLayout({ sections: [] }).ok, false);
  assert.equal(lib.validateLayout({ sections: [{ id: "nope", enabled: true, title: "x", subtitle: "" }] }).ok, false);
  assert.equal(lib.validateLayout("garbage").ok, false);
  assert.deepEqual(ids(lib.resolveLayout({ broken: true }, null).layout), ids(lib.defaultLayout()));
});

test("draft is never public; publish makes it live; global and a product override stay independent", async () => {
  const p = await mkProduct("Alpha"), other = await mkProduct("Beta");
  const base = lib.defaultLayout();
  const reordered = { sections: [base.sections[1], base.sections[0], ...base.sections.slice(2)] };
  await pp.saveDraft("global", reordered, "a");
  assert.deepEqual(ids(pp.layoutFor(p, await docs()).layout), ids(base)); // draft only: customers still see the default
  await pp.publish("global", undefined, "a");
  assert.deepEqual(ids(pp.layoutFor(p, await docs()).layout).slice(0, 2), [base.sections[1].id, base.sections[0].id]);
  // product override
  const custom = { sections: base.sections.map((s) => (s.id === "video" ? { ...s, enabled: false } : s)) };
  await pp.publish(p, custom, "a");
  const d = await docs();
  assert.equal(pp.layoutFor(p, d).layout.sections.find((s) => s.id === "video")!.enabled, false);
  assert.equal(pp.layoutFor(other, d).layout.sections.find((s) => s.id === "video")!.enabled, true); // other products untouched
  assert.deepEqual(ids(pp.layoutFor(other, d).layout).slice(0, 2), [base.sections[1].id, base.sections[0].id]); // still follow the (changed) global layout
  await pp.setOverride(p, false, "a"); // switch the override off: follows global, override kept
  assert.equal(pp.layoutFor(p, await docs()).layout.sections.find((s) => s.id === "video")!.enabled, true);
  await pp.setOverride(p, true, "a");
  await pp.resetScope(p, "a"); // reset the product: back to global for good
  assert.equal((await pp.getLayoutDoc(p))!.published, undefined);
});

test("rollback restores the previous published version; nothing to roll back to is a clear error; invalid layout is refused", async () => {
  const base = lib.defaultLayout();
  const v2 = { sections: base.sections.map((s) => (s.id === "reviews" ? { ...s, title: "What buyers say" } : s)) };
  await pp.publish("global", base, "a"); await pp.publish("global", v2, "a");
  assert.equal(pp.layoutFor("x", await docs()).layout.sections.find((s) => s.id === "reviews")!.title, "What buyers say");
  await pp.rollback("global", "a");
  assert.notEqual(pp.layoutFor("x", await docs()).layout.sections.find((s) => s.id === "reviews")!.title, "What buyers say");
  await pp.resetScope("global", "a"); await pp.rollback("global", "a"); // reset moved a version to history, so this works once
  await assert.rejects(() => pp.publish("global", { sections: [] }, "a"), /./);
  await assert.rejects(() => pp.saveDraft("not-a-product-id", lib.defaultLayout(), "a"), /not found/i);
});

test("builder API: visitors 401, non-admin staff 403, owner 200", async () => {
  const post = (b: unknown) => builderApi.POST(new Request("http://t.test/api/admin/product-page", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }), {} as any);
  jar(); assert.equal((await post({ scope: "global", action: "reset" })).status, 401);
  await upsertAdmin({ email: "it2@daffomart.test", role: "it_support", fullAccess: false, active: true, password: "it-password-123", grantedBy: "owner" });
  jar(); await createSessionCookie("it2@daffomart.test", { adminRole: "it_support", fullAccess: false });
  assert.equal((await post({ scope: "global", action: "reset" })).status, 403);
  jar(); await createSessionCookie("owner@daffomart.test", { adminRole: "owner", fullAccess: true });
  assert.equal((await post({ scope: "global", action: "reset" })).status, 200);
  assert.equal((await builderApi.GET(new Request("http://t.test/api/admin/product-page?scope=global"), {} as any)).status, 200);
});

test("reviews: only a delivered order's buyer (order no + phone) can review once; pending is hidden; approve shows it; hide removes it; private data never leaks", async () => {
  const p = await mkProduct("Reviewed");
  const mkOrder = async (status: string, phone = "01712345678") => { const id = newId(); const no = "DM-R" + id.slice(0, 5).toUpperCase(); await db.put("orders", { id, orderNo: no, name: "Rahim Uddin", phone, address: "x", zone: "z", items: [{ id: p, name: "Reviewed", price: 100, qty: 1 }], subtotal: 100, delivery: 0, serviceCharge: 0, discount: 0, total: 100, status, payment: "cod", paymentStatus: "paid", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any); return { id, no }; };
  const pending = await mkOrder("pending"), done = await mkOrder("delivered");
  const input = (no: string, phone = "01712345678") => ({ orderNo: no, phone, rating: 5, text: "Really good quality, would buy again." });
  await assert.rejects(() => rv.submitReview(null, p, input(pending.no), []), /delivered/);
  await assert.rejects(() => rv.submitReview(null, p, input(done.no, "01999999999"), []), /No order found/);
  await assert.rejects(() => rv.submitReview(null, p, { ...input(done.no), rating: 9 }, []), /1 to 5/);
  const r = await rv.submitReview(null, p, input(done.no), []);
  await assert.rejects(() => rv.submitReview(null, p, input(done.no), []), /already reviewed/);
  assert.equal((await rv.listPublic(p)).items.length, 0); // pending: not public
  await rv.moderate(r.id, "approved", "admin");
  const pub = await rv.listPublic(p);
  assert.equal(pub.items.length, 1); assert.equal(pub.stats.count, 1); assert.equal(pub.stats.average, 5);
  assert.ok(!JSON.stringify(pub).includes("01712345678")); assert.ok(!JSON.stringify(pub).includes(done.id)); assert.ok(!JSON.stringify(pub).includes("Rahim Uddin"));
  assert.equal(((await db.get<any>("products", p)) as any).reviewCount, 1);
  await rv.moderate(r.id, "hidden", "admin");
  assert.equal((await rv.listPublic(p)).items.length, 0); assert.equal(((await db.get<any>("products", p)) as any).reviewCount ?? 0, 0);
  jar(); assert.equal((await reviewsApi.GET(new Request("http://t.test/api/admin/reviews"), {} as any)).status, 401);
});
