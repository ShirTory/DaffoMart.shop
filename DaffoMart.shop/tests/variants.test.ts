import test from "node:test";
import assert from "node:assert/strict";
import { isolatedDataDir } from "./helpers.ts";
import { duplicateVariant, findVariant, hasVariants, normaliseVariants, optionAvailable, pickVariant, priceRange, rollup, usedAttrs, variantKey, variantLabel, variantStockProblem, withVariantStock } from "@/lib/variants";
import { lineKey } from "@/lib/cartRules";
import type { ProductVariant } from "@/lib/types";

isolatedDataDir();
const { db, newId } = await import("@/server/db");
const { createOrder, setOrderStatus, adjustStock, getZones } = await import("@/server/services");
const { productCfg } = await import("@/server/resources");
const { receivePurchase, createPurchase } = await import("@/server/accounting");

const V = (o: Partial<ProductVariant> & { id: string }): ProductVariant => ({ price: 100, stock: 5, ...o });
const SHIRT = [V({ id: "a", size: "M", color: "Red", price: 450, stock: 3 }), V({ id: "b", size: "L", color: "Red", price: 500, stock: 0 }), V({ id: "c", size: "M", color: "Blue", price: 470, oldPrice: 600, stock: 2 })];

/* ---------- pure helpers ---------- */
test("variant label and identity ignore case and spacing; duplicates are detected", () => {
  assert.equal(variantLabel({ size: "M", weight: "500 g", color: "Red" }), "M / 500 g / Red");
  assert.equal(variantLabel({ weight: " 1 kg " }), "1 kg");
  assert.equal(variantKey({ size: "m", color: "RED" }), variantKey({ size: " M ", color: "Red" }));
  assert.match(duplicateVariant([{ size: "M", color: "Red" }, { size: "m", color: "red" }]), /red.*twice/i);
  assert.equal(duplicateVariant([{ size: "M" }, { size: "L" }]), "");
});

test("product totals are derived from the options: cheapest price, summed stock, old price of the cheapest", () => {
  const r = rollup(SHIRT);
  assert.deepEqual(r, { price: 450, stock: 5 });
  assert.deepEqual(rollup([V({ id: "x", price: 90, oldPrice: 120, stock: 0 }), V({ id: "y", price: 100, stock: 9 })]), { price: 90, oldPrice: 120, stock: 9 }); // price never jumps because the cheap one sold out
  assert.deepEqual(priceRange(SHIRT), { min: 450, max: 500 });
});

test("withVariantStock moves ONE variant's stock, keeps the total in step, never goes below 0", () => {
  const a = withVariantStock({ variants: SHIRT }, "a", -2)!;
  assert.equal(findVariant(a, "a")!.stock, 1); assert.equal(a.stock, 3);
  assert.equal(withVariantStock({ variants: SHIRT }, "a", -99)!.variants!.find((v) => v.id === "a")!.stock, 0);
  assert.equal(withVariantStock({ variants: SHIRT }, "zzz", 1), null);
  assert.equal(withVariantStock({}, "a", 1), null);
  assert.equal(SHIRT[0].stock, 3, "input is not mutated");
});

test("normaliseVariants trims, drops rows with no size/weight/colour, keeps ids, assigns ids to new rows", () => {
  let n = 0;
  const out = normaliseVariants([{ id: "keep", size: " S ", price: 10, stock: 2.9 }, { price: 5, stock: 1 }, { color: "Red", price: 20, stock: -4, sku: "dm-1", oldPrice: 10 }], () => `new${++n}`);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, "keep"); assert.equal(out[0].size, "S"); assert.equal(out[0].stock, 2);
  assert.equal(out[1].id, "new1"); assert.equal(out[1].stock, 0); assert.equal(out[1].sku, "DM-1"); assert.equal(out[1].oldPrice, undefined, "old price must be above the price to count");
});

test("picking an option keeps the other chosen options when that combination is in stock, otherwise falls back sensibly", () => {
  const cur = SHIRT[0]; // M / Red
  assert.equal(pickVariant(SHIRT, cur, "color", "Blue")!.id, "c"); // M / Blue exists
  assert.equal(pickVariant(SHIRT, cur, "size", "L")!.id, "b"); // L only exists out of stock: still selectable so it can show "out of stock"
  assert.deepEqual(usedAttrs(SHIRT), ["size", "color"]);
  assert.equal(optionAvailable(SHIRT, "size", "L"), false);
  assert.equal(optionAvailable(SHIRT, "size", "M"), true);
});

test("cart line key: same product with another variant is a separate line", () => {
  assert.equal(lineKey({ id: "p1" }), "p1");
  assert.notEqual(lineKey({ id: "p1", vid: "a" }), lineKey({ id: "p1", vid: "b" }));
});

test("variantStockProblem: option required, must exist, stock checked", () => {
  const p = { name: "Shirt", variants: SHIRT };
  assert.match(variantStockProblem(p, undefined, 1), /choose an option/i);
  assert.match(variantStockProblem(p, "nope", 1), /no longer available/);
  assert.match(variantStockProblem(p, "b", 1), /out of stock/);
  assert.match(variantStockProblem(p, "a", 4), /Only 3 of Shirt \(M \/ Red\)/);
  assert.equal(variantStockProblem(p, "a", 3), "");
  assert.equal(variantStockProblem({ name: "Plain" }, undefined, 9), "");
});

/* ---------- server: saving, ordering, stock ---------- */
const zone = (await getZones())[0];
const base = { name: "Test Buyer", phone: "01712345678", address: "House 1, Road 2, Dhaka", zone: zone.id, payment: "cod", note: "" };
const mk = async (variants: ProductVariant[] | undefined, over: Record<string, unknown> = {}) => {
  const id = newId(); const r = rollup(variants ?? [V({ id: "x" })]);
  await db.put("products", { id, slug: id, name: `Shirt-${id.slice(0, 4)}`, description: "", price: r.price, unit: "1 pc", emoji: "👕", images: [], categoryId: "x", stock: variants ? r.stock : 5, ...(variants ? { variants } : {}), rating: 0, sold: 0, featured: false, active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", ...over });
  return id;
};
const get = async (id: string) => (await db.get<any>("products", id))!;
const vStock = (p: any, vid: string) => p.variants.find((v: any) => v.id === vid).stock;

test("saving a product with options derives its price / old price / stock and keeps option ids", async () => {
  const rec: any = await productCfg.prepare({ name: "Tee", sku: `TEE-${newId()}`, active: true, price: 1, stock: 99, unit: "1 pc", images: [], variants: [{ id: "keepme", size: "M", price: 450, stock: 3 }, { size: "L", price: 400, oldPrice: 500, stock: 2 }] }, null, newId());
  assert.equal(rec.price, 400); assert.equal(rec.oldPrice, 500); assert.equal(rec.stock, 5, "typed price / stock are ignored when options exist");
  assert.equal(rec.variants.length, 2); assert.equal(rec.variants[0].id, "keepme"); assert.ok(rec.variants[1].id);
  const plain: any = await productCfg.prepare({ name: "Plain", sku: `PL-${newId()}`, active: true, price: 7, stock: 4, unit: "1 pc", images: [], variants: [] }, null, newId());
  assert.equal(plain.variants, undefined); assert.equal(plain.price, 7); assert.equal(plain.stock, 4);
});

test("order uses the SERVER price of the chosen variant and takes stock from that variant only", async () => {
  const id = await mk(structuredClone(SHIRT));
  const o = await createOrder({ ...base, items: [{ id, variantId: "a", qty: 2 }] } as any);
  assert.equal(o.items[0].price, 450); assert.equal(o.items[0].unit, "M / Red"); assert.equal(o.items[0].variantId, "a"); assert.equal(o.subtotal, 900);
  const p = await get(id);
  assert.equal(vStock(p, "a"), 1); assert.equal(vStock(p, "c"), 2, "other variants untouched"); assert.equal(p.stock, 3); assert.equal(p.sold, 2);
});

test("two variants of one product in one order: each priced and decremented correctly", async () => {
  const id = await mk(structuredClone(SHIRT));
  const o = await createOrder({ ...base, items: [{ id, variantId: "a", qty: 1 }, { id, variantId: "c", qty: 2 }] } as any);
  assert.equal(o.items.length, 2); assert.equal(o.subtotal, 450 + 2 * 470);
  const p = await get(id); assert.equal(vStock(p, "a"), 2); assert.equal(vStock(p, "c"), 0); assert.equal(p.stock, 2); assert.equal(p.sold, 3);
});

test("order is refused (and nothing changes) for: no option chosen, unknown option, sold-out option, too many", async () => {
  const id = await mk(structuredClone(SHIRT));
  const orders = (await db.list("orders")).length;
  await assert.rejects(createOrder({ ...base, items: [{ id, qty: 1 }] } as any), (e: any) => e.status === 400 && /choose an option/i.test(e.message));
  await assert.rejects(createOrder({ ...base, items: [{ id, variantId: "ghost", qty: 1 }] } as any), (e: any) => e.status === 400);
  await assert.rejects(createOrder({ ...base, items: [{ id, variantId: "b", qty: 1 }] } as any), (e: any) => e.status === 409 && /out of stock/.test(e.message));
  await assert.rejects(createOrder({ ...base, items: [{ id, variantId: "a", qty: 2 }, { id, variantId: "a", qty: 2 }] } as any), (e: any) => e.status === 409 && /Only 3/.test(e.message), "duplicate lines of one option are added up");
  const plain = await mk(undefined);
  await assert.rejects(createOrder({ ...base, items: [{ id: plain, variantId: "a", qty: 1 }] } as any), (e: any) => e.status === 400);
  assert.equal((await db.list("orders")).length, orders); const p = await get(id); assert.equal(p.stock, 5); assert.equal(vStock(p, "a"), 3);
});

test("the database step refuses to oversell an option even if the earlier check was stale", async () => {
  const id = await mk(structuredClone(SHIRT));
  const order = { id: newId(), items: [] };
  await assert.rejects(db.placeOrder(order as any, [{ id, variantId: "b", qty: 1 }]), (e: any) => e.name === "StockError");
  await assert.rejects(db.placeOrder({ id: newId() } as any, [{ id, qty: 1 }]), (e: any) => e.name === "StockError", "options products need a variant");
  assert.equal((await get(id)).stock, 5);
});

test("8 concurrent buyers of a 3-unit option => exactly 3 orders; the other options are unaffected", async () => {
  const id = await mk(structuredClone(SHIRT));
  const res = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => createOrder({ ...base, idempotencyKey: `variant-race-${i}-0123456789abcd`, items: [{ id, variantId: "a", qty: 1 }] } as any)));
  assert.equal(res.filter((r) => r.status === "fulfilled").length, 3);
  const p = await get(id); assert.equal(vStock(p, "a"), 0); assert.equal(vStock(p, "c"), 2); assert.equal(p.stock, 2);
});

test("cancelling gives the stock back to the SAME option, once", async () => {
  const id = await mk(structuredClone(SHIRT));
  const o = await createOrder({ ...base, items: [{ id, variantId: "c", qty: 2 }] } as any);
  assert.equal(vStock(await get(id), "c"), 0);
  await setOrderStatus(o.id, "cancelled"); await setOrderStatus(o.id, "cancelled");
  let p = await get(id); assert.equal(vStock(p, "c"), 2); assert.equal(p.stock, 5); assert.equal(p.sold, 0);
  await setOrderStatus(o.id, "pending"); p = await get(id); assert.equal(vStock(p, "c"), 0, "re-opening takes it again");
});

test("inventory: an option must be named; adjusting one option updates the product total and the log", async () => {
  const id = await mk(structuredClone(SHIRT));
  await assert.rejects(adjustStock(id, "add", 5, "x"), (e: any) => e.status === 400 && /choose which one/.test(e.message));
  await assert.rejects(adjustStock(id, "add", 5, "x", "ghost"), (e: any) => e.status === 400);
  const r = await adjustStock(id, "add", 10, "Restock", "b");
  assert.equal(vStock(r.product, "b"), 10); assert.equal(r.product.stock, 15); assert.equal(r.log.before, 0); assert.equal(r.log.after, 10); assert.match(r.log.productName, /L \/ Red/);
  const s = await adjustStock(id, "set", 1, "Count", "a"); assert.equal(s.product.stock, 13);
});

test("purchases: a line for an options product must name the option; receiving adds stock to that option", async () => {
  const id = await mk(structuredClone(SHIRT)); const sup = newId();
  await db.put("suppliers", { id: sup, name: "Sup", createdAt: "2026-01-01T00:00:00.000Z" } as any);
  await assert.rejects(createPurchase({ supplierId: sup, date: "2026-10-01", items: [{ productId: id, qty: 4, unitCost: 200 }], by: "t" } as any), (e: any) => e.status === 400 && /choose which option/.test(e.message));
  const p: any = await createPurchase({ supplierId: sup, date: "2026-10-01", items: [{ productId: id, variantId: "b", qty: 4, unitCost: 200 }], by: "t" } as any);
  assert.equal(p.items[0].variantId, "b"); assert.match(p.items[0].name, /L \/ Red/);
  await receivePurchase(p.id); await receivePurchase(p.id); // second call is a no-op: stock added once
  const prod = await get(id);
  assert.equal(vStock(prod, "b"), 4); assert.equal(prod.stock, 9); assert.equal(vStock(prod, "a"), 3);
});
