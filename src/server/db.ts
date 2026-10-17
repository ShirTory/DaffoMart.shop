import { randomBytes } from "crypto";
import { revalidateTag } from "next/cache";
import fs from "fs";
import path from "path";

export type Col = "products" | "categories" | "banners" | "offers" | "orders" | "settings" | "zones" | "riders" | "stocklogs" | "images" | "nid" | "employees" | "attendance" | "couriers" | "payment_methods" | "ratings" | "issues";
export const newId = () => randomBytes(8).toString("hex");

interface Driver {
  readonly name: "firestore" | "local";
  list(col: Col): Promise<any[]>;
  get(col: Col, id: string): Promise<any | null>;
  put(col: Col, id: string, data: any): Promise<void>;
  remove(col: Col, id: string): Promise<void>;
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
  };
}

const g = globalThis as unknown as { __dmDriver?: Driver; __dmSeed?: Promise<void> };
export const driver = (): Driver => (g.__dmDriver ??= firebaseConfigured() ? firestoreDriver() : localDriver());
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
  async update<T extends { id: string }>(col: Col, id: string, patch: Partial<T>): Promise<T | null> {
    await ready(); const cur = await driver().get(col, id); if (!cur) return null;
    const next = { ...cur, ...patch, id }; await driver().put(col, id, next); bust(col); return next;
  },
  async remove(col: Col, id: string) { await ready(); await driver().remove(col, id); bust(col); },
};
