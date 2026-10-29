import test from "node:test";
import assert from "node:assert/strict";
import { isolatedDataDir } from "./helpers.ts";

isolatedDataDir();
process.env.ADMIN_EMAIL = "owner@daffomart.test";
process.env.ADMIN_PASSWORD = "owner-password-123";
process.env.AUTH_SECRET = "y".repeat(40);

const { db, newId } = await import("@/server/db");
const { createSessionCookie } = await import("@/server/auth");
const reorder = await import("@/app/api/categories/reorder/route");

const jar = (j: Record<string, string> = {}) => ((globalThis as any).__testCookies = j);
const post = async (body: unknown) => {
  const r: Response = await reorder.POST(new Request("http://t.test/api/categories/reorder", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "7.7.7.7" }, body: JSON.stringify(body) }));
  return { status: r.status, body: await r.json().catch(() => null) };
};
const mk = async (name: string, sortOrder: number) => { const id = newId(); await db.put("categories", { id, name, slug: name.toLowerCase(), emoji: "🛍️", active: true, sortOrder } as any); return id; };
const order = async () => (await db.list<any>("categories")).sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.name);

test("reorder: refused without an admin session", async () => {
  jar();
  assert.equal((await post({ ids: ["x"] })).status, 401);
});

test("reorder: admin's order is saved as 1..n, unknown ids ignored, unlisted categories keep their place after", async () => {
  const a = await mk("Alpha", 5), b = await mk("Bravo", 5), c = await mk("Charlie", 9), d = await mk("Delta", 2);
  jar(); await createSessionCookie("owner@daffomart.test", { adminRole: "owner", fullAccess: true });
  const r = await post({ ids: [c, "ghost", a] });
  assert.equal(r.status, 200);
  const names = (await order()).filter((n) => ["Alpha", "Bravo", "Charlie", "Delta"].includes(n));
  assert.deepEqual(names, ["Charlie", "Alpha", "Delta", "Bravo"]); // listed first, then the rest in their previous order (Delta 2, Bravo 5)
  const all = (await db.list<any>("categories")).map((x) => x.sortOrder).sort((x, y) => x - y);
  assert.deepEqual(all, all.map((_, i) => i + 1), "numbers are rewritten as a clean 1..n");
  void b; void d;
});

test("reorder: moving one category up by one swaps just that pair", async () => {
  jar(); await createSessionCookie("owner@daffomart.test", { adminRole: "owner", fullAccess: true });
  const cur = (await db.list<any>("categories")).sort((x, y) => x.sortOrder - y.sortOrder).map((x) => x.id);
  const next = [...cur]; [next[2], next[1]] = [next[1], next[2]];
  await post({ ids: next });
  const after = (await db.list<any>("categories")).sort((x, y) => x.sortOrder - y.sortOrder).map((x) => x.id);
  assert.deepEqual(after, next);
});
