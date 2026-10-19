import { randomBytes } from "crypto";
import { revalidateTag } from "next/cache";
import fs from "fs";
import path from "path";

export type Col = "products" | "categories" | "banners" | "offers" | "orders" | "settings" | "zones" | "riders" | "stocklogs" | "images" | "nid" | "employees" | "attendance" | "couriers" | "payment_methods" | "ratings" | "issues" | "audit_logs" | "admins" | "customers" | "finance_expenses" | "finance_incomes" | "suppliers" | "purchases" | "payroll" | "finance_payments" | "finance_accounts" | "sku_index";
export const newId = () => randomBytes(8).toString("hex");

/** Thrown by `placeOrder` when a product cannot be sold; services.ts turns it into a customer-facing ApiError. */
export class StockError extends Error {
  constructor(public kind: "unavailable" | "out_of_stock" | "insufficient", message: string, public available = 0) { super(message); this.name = "StockError"; }
}
export type OrderLine = { id: string; qty: number };

/**
 * Pure stock check shared by both drivers: given the current product documents, returns the stock updates to apply
 * or throws StockError. Kept free of I/O so the same rule runs inside a Firestore transaction and the local driver.
 */
export function planStock(products: (any | undefined)[], lines: OrderLine[], nowIso: string) {
  return lines.map((l, i) => {
    const p = products[i];
    if (!p || !p.active) throw new StockError("unavailable", "A product in your cart is no longer available. Please review your cart.");
    const stock = Number(p.stock) || 0;
    if (stock < l.qty) throw new StockError(stock <= 0 ? "out_of_stock" : "insufficient", stock <= 0 ? `${p.name} is out of stock` : `Only ${stock} of ${p.name} left in stock`, stock);
    return { id: l.id as string, patch: { stock: stock - l.qty, sold: (Number(p.sold) || 0) + l.qty, updatedAt: nowIso } };
  });
}

interface Driver {
  readonly name: "firestore" | "local";
  list(col: Col): Promise<any[]>;
  get(col: Col, id: string): Promise<any | null>;
  put(col: Col, id: string, data: any): Promise<void>;
  remove(col: Col, id: string): Promise<void>;
  /** Equality lookup on one field (indexed on Firestore; no full-collection scan). */
  find(col: Col, field: string, value: string | number | boolean): Promise<any[]>;
  /** Atomic read-modify-write of ONE document (Firestore transaction / synchronous in the local driver). `fn` may run more than once and must be free of side effects. Returning null/undefined writes nothing. */
  mutate(col: Col, id: string, fn: (cur: any | null) => any | null | undefined): Promise<any | null>;
  /** Atomic create-if-absent. Returns false (and writes nothing) when the document already exists. */
  create(col: Col, id: string, data: any): Promise<boolean>;
  /**
   * Atomically: if an order with this id already exists return it (`duplicate: true`, nothing changes);
   * otherwise verify and decrement stock for every line and create the order. All or nothing.
   */
  placeOrder(order: { id: string }, lines: OrderLine[]): Promise<{ order: any; duplicate: boolean }>;
}

/* ---------- Firebase Admin helpers (shared with storage.ts) ---------- */
export const firebaseConfigured = () => Boolean(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && (process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID));
export async function firebaseAdmin() {
  const { getApps, initializeApp, cert, getApp } = await import("firebase-admin/app");
  if (getApps().length) return getApp();
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

/* ---------- Firestore driver ---------- */
function firestoreDriver(): Driver {
  const store = async () => { const { getFirestore } = await import("firebase-admin/firestore"); return getFirestore(await firebaseAdmin()); };
  return {
    name: "firestore",
    async list(col) { const s = await (await store()).collection(col).get(); return s.docs.map((d) => ({ ...d.data(), id: d.id })); },
    async get(col, id) { const d = await (await store()).collection(col).doc(id).get(); return d.exists ? { ...d.data(), id: d.id } : null; },
    async put(col, id, data) { await (await store()).collection(col).doc(id).set(JSON.parse(JSON.stringify(data))); },
    async remove(col, id) { await (await store()).collection(col).doc(id).delete(); },
    async find(col, field, value) { const s = await (await store()).collection(col).where(field, "==", value).get(); return s.docs.map((d) => ({ ...d.data(), id: d.id })); },
    async mutate(col, id, fn) {
      const firestore = await store(); const ref = firestore.collection(col).doc(id);
      return firestore.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const next = fn(snap.exists ? { ...snap.data(), id: snap.id } : null);
        if (next === null || next === undefined) return null;
        const clean = JSON.parse(JSON.stringify({ ...next, id }));
        tx.set(ref, clean);
        return clean;
      });
    },
    async create(col, id, data) {
      try { await (await store()).collection(col).doc(id).create(JSON.parse(JSON.stringify(data))); return true; }
      catch (e: any) { if (e?.code === 6 || /ALREADY_EXISTS/i.test(String(e?.message))) return false; throw e; } // gRPC 6 = ALREADY_EXISTS
    },
    async placeOrder(order, lines) {
      const firestore = await store();
      const clean = JSON.parse(JSON.stringify(order));
      // A Firestore transaction retries on contention, so two customers can never both take the last item,
      // even across separate serverless instances. The callback must stay free of side effects.
      return firestore.runTransaction(async (tx) => {
        const orderRef = firestore.collection("orders").doc(order.id);
        const existing = await tx.get(orderRef);
        if (existing.exists) return { order: { ...existing.data(), id: existing.id }, duplicate: true };
        const refs = lines.map((l) => firestore.collection("products").doc(l.id));
        const snaps = await tx.getAll(...refs);
        const plan = planStock(snaps.map((d) => (d.exists ? d.data() : undefined)), lines, new Date().toISOString());
        plan.forEach((u, i) => tx.update(refs[i], u.patch));
        tx.set(orderRef, clean);
        return { order: clean, duplicate: false };
      });
    },
  };
}

/* ---------- Local JSON-file driver (development / demo) ---------- */
export const dataDir = () => process.env.DATA_DIR || (process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME ? "/tmp/daffomart" : path.join(process.cwd(), ".data"));
function localDriver(): Driver {
  const file = path.join(dataDir(), "db.json");
  let cache: Record<string, Record<string, any>> | null = null;
  let writing: Promise<void> = Promise.resolve();
  const load = () => {
    if (cache) return cache;
    try { cache = JSON.parse(fs.readFileSync(file, "utf8")); } catch { cache = {}; }
    return cache!;
  };
  const persist = () => {
    writing = writing.then(async () => {
      await fs.promises.mkdir(path.dirname(file), { recursive: true });
      const tmp = file + ".tmp";
      await fs.promises.writeFile(tmp, JSON.stringify(cache, null, 2));
      await fs.promises.rename(tmp, file);
    }).catch((e) => console.error("[db] write failed", e));
    return writing;
  };
  return {
    name: "local",
    async list(col) { return Object.values(load()[col] ?? {}).map((x) => structuredClone(x)); },
    async get(col, id) { const x = load()[col]?.[id]; return x ? structuredClone(x) : null; },
    async put(col, id, data) { const c = load(); (c[col] ??= {})[id] = { ...JSON.parse(JSON.stringify(data)), id }; await persist(); },
    async remove(col, id) { const c = load(); if (c[col]) delete c[col][id]; await persist(); },
    async find(col, field, value) { return Object.values(load()[col] ?? {}).filter((x: any) => x?.[field] === value).map((x) => structuredClone(x)); },
    async mutate(col, id, fn) {
      const c = load(); const cur = c[col]?.[id];
      const next = fn(cur ? structuredClone(cur) : null); // no await between read and write: atomic within one process
      if (next === null || next === undefined) return null;
      const saved = { ...JSON.parse(JSON.stringify(next)), id };
      (c[col] ??= {})[id] = saved; await persist(); return structuredClone(saved);
    },
    async create(col, id, data) {
      const c = load(); if (c[col]?.[id]) return false; // no await before the write: atomic within one process
      (c[col] ??= {})[id] = { ...JSON.parse(JSON.stringify(data)), id }; await persist(); return true;
    },
    async placeOrder(order, lines) {
      // No `await` between the check and the writes below, so on a single process this is atomic.
      const c = load();
      const existing = c.orders?.[order.id];
      if (existing) return { order: structuredClone(existing), duplicate: true };
      const plan = planStock(lines.map((l) => c.products?.[l.id]), lines, new Date().toISOString());
      for (const u of plan) c.products[u.id] = { ...c.products[u.id], ...u.patch };
      const saved = { ...JSON.parse(JSON.stringify(order)) };
      (c.orders ??= {})[order.id] = saved;
      await persist();
      return { order: structuredClone(saved), duplicate: false };
    },
  };
}

const g = globalThis as unknown as { __dmDriver?: Driver; __dmSeed?: Promise<void> };
/** Non-empty when the site would run on throw-away storage in production (serverless /tmp loses every order on a cold start). */
export function storageProblem(): string {
  const prod = process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";
  const serverless = Boolean(process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (prod && serverless && !firebaseConfigured() && !process.env.DATA_DIR && process.env.ALLOW_EPHEMERAL_STORAGE !== "true")
    return "Firebase is not configured: on this host data would be written to temporary storage and LOST. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.";
  return "";
}
export const driver = (): Driver => {
  if (g.__dmDriver) return g.__dmDriver;
  if (firebaseConfigured()) return (g.__dmDriver = firestoreDriver());
  const problem = storageProblem(); if (problem) throw new Error(problem); // fail closed instead of silently losing data
  return (g.__dmDriver = localDriver());
};
export const storageMode = () => driver().name;

async function ready() {
  g.__dmSeed ??= (async () => {
    const { seedIfEmpty } = await import("./seed");
    await seedIfEmpty();
  })().catch((e) => { g.__dmSeed = undefined; throw e; });
  await g.__dmSeed;
}

/** Raw access used by the seeder (no ready() gate, avoids recursion). */
export const rawDb = { list: (c: Col) => driver().list(c), get: (c: Col, id: string) => driver().get(c, id), put: (c: Col, id: string, d: any) => driver().put(c, id, d) };

/** Storefront data (products, categories, banners, offers, settings, zones) is cached; any write through `db` refreshes it at once. */
export const STORE_TAG = "store";
const STORE_COLS = new Set<Col>(["products", "categories", "banners", "offers", "settings", "zones"]);
const bust = (col: Col) => { if (STORE_COLS.has(col)) { try { revalidateTag(STORE_TAG); } catch { /* not inside a request: the 60 s timer refreshes it */ } } };

export const db = {
  async list<T>(col: Col): Promise<T[]> { await ready(); return driver().list(col); },
  async get<T>(col: Col, id: string): Promise<T | null> { await ready(); return driver().get(col, id); },
  async put<T extends { id: string }>(col: Col, data: T): Promise<T> { await ready(); await driver().put(col, data.id, data); bust(col); return data; },
  /** Atomic merge (transaction): concurrent updates of one document can no longer overwrite each other. */
  async update<T extends { id: string }>(col: Col, id: string, patch: Partial<T>): Promise<T | null> {
    await ready(); const next = await driver().mutate(col, id, (cur) => (cur ? { ...cur, ...patch, id } : null)); if (next) bust(col); return next;
  },
  /** Atomic read-modify-write; `fn` must be pure (it can be retried). */
  async mutate<T extends { id: string }>(col: Col, id: string, fn: (cur: T | null) => T | null | undefined): Promise<T | null> {
    await ready(); const next = await driver().mutate(col, id, fn as any); if (next) bust(col); return next;
  },
  /** Equality query on one field. */
  async find<T>(col: Col, field: string, value: string | number | boolean): Promise<T[]> { await ready(); return driver().find(col, field, value); },
  async remove(col: Col, id: string) { await ready(); await driver().remove(col, id); bust(col); },
  /** Atomic create-if-absent (used for unique keys such as SKUs). */
  async create<T extends { id: string }>(col: Col, data: T): Promise<boolean> { await ready(); const done = await driver().create(col, data.id, data); if (done) bust(col); return done; },
  /** Atomic checkout write: stock check + decrement + order creation (idempotent on `order.id`). Throws StockError. */
  async placeOrder<T extends { id: string }>(order: T, lines: OrderLine[]): Promise<{ order: T; duplicate: boolean }> {
    await ready();
    const r = await driver().placeOrder(order, lines);
    if (!r.duplicate) bust("products"); // stock changed: refresh the cached storefront at once
    return r;
  },
};
