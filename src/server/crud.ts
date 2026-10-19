import type { ZodTypeAny } from "zod";
import { db, newId, type Col } from "./db";
import { requireAdmin, getFullAdmin } from "./auth";
import { ApiError, handle, ok, readJson } from "./http";

interface Cfg<T extends { id: string }> {
  col: Col; schema: ZodTypeAny;
  /** build the stored record (adds id/timestamps/defaults). `prev` is null on create. */
  prepare: (data: any, prev: T | null, id?: string) => Promise<Omit<T, "id">> | Omit<T, "id">;
  /** what the public (non-admin) is allowed to see */
  visible?: (item: T) => boolean;
  sort?: (a: T, b: T) => number;
  beforeDelete?: (id: string) => Promise<void>;
  /** shape what is sent to clients (e.g. strip secrets) */
  present?: (item: T) => T;
  /** extra shaping for visitors WITHOUT full admin access (e.g. hide purchase cost) */
  publicPresent?: (item: T) => T;
}

export function collectionRoutes<T extends { id: string }>(c: Cfg<T>) {
  const outFor = (admin: unknown) => (x: T) => { const y = c.present ? c.present(x) : x; return !admin && c.publicPresent ? c.publicPresent(y) : y; };
  return {
    GET: handle(async (req) => {
      const admin = await getFullAdmin();
      let items = await db.list<T>(c.col);
      if (!admin && c.visible) items = items.filter(c.visible);
      if (c.sort) items.sort(c.sort);
      return ok(items.map(outFor(admin)));
    }),
    POST: handle(async (req) => {
      const admin = await requireAdmin(); const out = outFor(admin);
      const data = c.schema.parse(await readJson(req));
      const id = newId();
      const rec = { ...(await c.prepare(data, null, id)), id } as T;
      return ok(out(await db.put(c.col, rec)), 201);
    }),
  };
}

export function itemRoutes<T extends { id: string }>(c: Cfg<T>) {
  const outFor = (admin: unknown) => (x: T) => { const y = c.present ? c.present(x) : x; return !admin && c.publicPresent ? c.publicPresent(y) : y; };
  const find = async (ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params; const item = await db.get<T>(c.col, id);
    if (!item) throw new ApiError(404, "Not found"); return item;
  };
  return {
    GET: handle(async (_r, ctx) => {
      const item = await find(ctx); const admin = await getFullAdmin();
      if (!admin && c.visible && !c.visible(item)) throw new ApiError(404, "Not found");
      return ok(outFor(admin)(item));
    }),
    PUT: handle(async (req, ctx) => {
      const admin = await requireAdmin(); const out = outFor(admin); const prev = await find(ctx);
      const data = c.schema.parse(await readJson(req));
      const rec = { ...(await c.prepare(data, prev, prev.id)), id: prev.id } as T;
      return ok(out(await db.put(c.col, rec)));
    }),
    DELETE: handle(async (_r, ctx) => {
      await requireAdmin(); const prev = await find(ctx);
      if (c.beforeDelete) await c.beforeDelete(prev.id);
      await db.remove(c.col, prev.id);
      return ok({ id: prev.id });
    }),
  };
}
