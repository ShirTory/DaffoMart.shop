import test from "node:test";
import assert from "node:assert/strict";
import { isolatedDataDir } from "./helpers.ts";

isolatedDataDir();
process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.com";
process.env.ADMIN_EMAIL = "owner@daffomart.test"; process.env.ADMIN_PASSWORD = "owner-password-123"; process.env.AUTH_SECRET = "y".repeat(40);
const { db, newId } = await import("@/server/db");
const seo = await import("@/server/seo");
const lib = await import("@/lib/seo");
const sitemap = (await import("@/app/sitemap")).default;
const robots = (await import("@/app/robots")).default;
const route = await import("@/app/api/admin/seo/[key]/route");
const { createSessionCookie } = await import("@/server/auth");
const q = await import("@/server/queries");
const { upsertAdmin } = await import("@/server/adminAccounts");

const mkProduct = async (name: string, extra: Record<string, unknown> = {}) => {
  const id = newId(); await db.put("products", { id, name, slug: name.toLowerCase().replace(/\s+/g, "-"), price: 100, stock: 5, active: true, unit: "1pc", images: [], categoryId: "c1", sold: 0, rating: 0, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", ...extra } as any); return id;
};
const cookieJar = (j: Record<string, string> = {}) => ((globalThis as any).__testCookies = j);

test("normalizeSeo: trims, drops empties, validates lengths, image and canonical", () => {
  const now = "2026-10-30T00:00:00.000Z";
  const e = seo.normalizeSeo("home", { title: "  Best  groceries ", description: "", keywords: "rice, , oil ,", noindex: false }, "a", now);
  assert.equal(e.title, "Best groceries"); assert.equal(e.description, undefined); assert.equal(e.keywords, "rice, oil"); assert.equal(e.noindex, undefined);
  assert.throws(() => seo.normalizeSeo("home", { title: "x".repeat(71) }, "a", now), /at most 70/);
  assert.throws(() => seo.normalizeSeo("home", { description: "x".repeat(201) }, "a", now), /at most 200/);
  assert.throws(() => seo.normalizeSeo("home", { image: "javascript:alert(1)" }, "a", now), /image/i);
  assert.throws(() => seo.normalizeSeo("home", { canonical: "https://evil.example.org/x" }, "a", now), /canonical/i);
  assert.equal(seo.normalizeSeo("home", { canonical: "https://shop.example.com/products/rice" }, "a", now).canonical, "/products/rice");
  assert.throws(() => seo.normalizeSeo("../etc", {}, "a", now), /Unknown page/);
});

test("withSeo / pageMeta: admin values replace automatic ones, empty fields keep them, noindex only ever adds", () => {
  const base = { title: "Auto", description: "Auto desc", path: "/products/x", image: "/a.png" };
  assert.deepEqual(lib.withSeo(base, null), base);
  const m = lib.withSeo(base, { id: "x", title: "Custom", keywords: "a,b", noindex: true, updatedAt: "", updatedBy: "" });
  assert.equal(m.title, "Custom"); assert.equal(m.description, "Auto desc"); assert.equal(m.noindex, true);
  const meta = lib.pageMeta(m) as any;
  assert.deepEqual(meta.keywords, ["a", "b"]); assert.equal(meta.alternates.canonical, "/products/x"); assert.equal(meta.robots.index, false); assert.equal(meta.openGraph.title, "Custom");
  assert.equal((lib.pageMeta(base) as any).robots, undefined);
});

test("saving SEO persists, shows up in the storefront reader, and clearing every field returns to automatic", async () => {
  const pid = await mkProduct("Premium Rice");
  await seo.saveSeo(`product:${pid}`, { title: "Premium Rice 5kg | DaffoMart", description: "Fresh rice" }, "admin@t");
  assert.equal((await q.getSeoMap())[`product:${pid}`].title, "Premium Rice 5kg | DaffoMart");
  await seo.saveSeo(`product:${pid}`, { title: "", description: "" }, "admin@t");
  assert.equal((await q.getSeoMap())[`product:${pid}`], undefined);
  await assert.rejects(() => seo.saveSeo("product:missing", { title: "x" }, "a"), /not found/);
  await assert.rejects(() => seo.saveSeo("category:missing", { title: "x" }, "a"), /not found/);
});

test("sitemap follows the catalogue: new product appears, edited slug follows, deleted/inactive/noindex products disappear", async () => {
  const a = await mkProduct("Sitemap Alpha"), b = await mkProduct("Sitemap Beta");
  let urls = (await sitemap()).map((x) => x.url);
  assert.ok(urls.includes("https://shop.example.com/products/sitemap-alpha")); assert.ok(urls.includes("https://shop.example.com/products/sitemap-beta"));
  await db.update("products", a, { slug: "sitemap-alpha-renamed" } as any);
  urls = (await sitemap()).map((x) => x.url);
  assert.ok(urls.includes("https://shop.example.com/products/sitemap-alpha-renamed")); assert.ok(!urls.includes("https://shop.example.com/products/sitemap-alpha"));
  await seo.saveSeo(`product:${b}`, { noindex: true }, "admin@t");
  assert.ok(!(await sitemap()).map((x) => x.url).includes("https://shop.example.com/products/sitemap-beta"));
  await seo.saveSeo(`product:${b}`, { noindex: false }, "admin@t"); // back to automatic -> listed again
  assert.ok((await sitemap()).map((x) => x.url).includes("https://shop.example.com/products/sitemap-beta"));
  await db.remove("products", b);
  assert.ok(!(await sitemap()).map((x) => x.url).includes("https://shop.example.com/products/sitemap-beta"));
  await seo.saveSeo("contact", { noindex: true }, "admin@t");
  assert.ok(!(await sitemap()).map((x) => x.url).includes("https://shop.example.com/contact"));
  assert.ok((await sitemap()).every((x) => !/\/(cart|checkout|admin|track)/.test(x.url)));
});

test("robots.txt: blocks private areas, allows uploads, points to the sitemap", () => {
  const r = robots() as any;
  assert.equal(r.sitemap, "https://shop.example.com/sitemap.xml");
  assert.ok(r.rules[0].disallow.includes("/admin") && r.rules[0].disallow.includes("/checkout") && r.rules[0].allow.includes("/api/uploads/"));
});

test("SEO admin API: visitors get 401, an Accountant 403, the owner can save and the page then shows it", async () => {
  const call = (body: unknown) => route.PUT(new Request("http://t.test/api/admin/seo/home", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ key: "home" }) } as any);
  cookieJar();
  assert.equal((await call({ title: "Hacked" })).status, 401);
  await upsertAdmin({ email: "acc@daffomart.test", role: "accountant", fullAccess: false, active: true, password: "acc-password-123", grantedBy: "owner" });
  cookieJar(); await createSessionCookie("acc@daffomart.test", { adminRole: "accountant", fullAccess: false });
  assert.equal((await call({ title: "Hacked" })).status, 403);
  assert.equal((await q.getSeoMap()).home, undefined);
  cookieJar(); await createSessionCookie("owner@daffomart.test", { adminRole: "owner", fullAccess: true });
  assert.equal((await call({ title: "Welcome to DaffoMart" })).status, 200);
  assert.equal((await q.getSeoMap()).home.title, "Welcome to DaffoMart");
  assert.equal((await call({ title: "x".repeat(90) })).status, 400);
});
