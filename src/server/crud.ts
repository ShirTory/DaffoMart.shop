import type { ZodTypeAny } from "zod";
import { db, newId, type Col } from "./db";
import { requireAdmin, getAdmin } from "./auth";
import { ApiError, handle, ok, readJson } from "./http";

interface Cfg<T extends { id: string }> {
  col: Col; schema: ZodTypeAny;
  /** build the stored record (adds id/timestamps/defaults). `prev` is null on create. */
  prepare: (data: any, prev: T | null) => Promise<Omit<T, "id">> | Omit<T, "id">;
  /** what the public (non-admin) is allowed to see */
  visible?: (item: T) => boolean;
  sort?: (a: T, b: T) => number;
  beforeDelete?: (id: string) => Promise<void>;
  /** shape what is sent to clients (e.g. strip secrets) */
  present?: (item: T) => T;
}

export function collectionRoutes<T extends { id: string }>(c: Cfg<T>) {
  const out = (x: T) => (c.present ? c.present(x) : x);
  return {
    GET: handle(async (req) => {
      const admin = await getAdmin();
      let items = await db.list<T>(c.col);
      if (!admin && c.visible) items = items.filter(c.visible);
      if (c.sort) items.sort(c.sort);
      return ok(items.map(out));
    }),
    POST: handle(async (req) => {
      await requireAdmin();
      const data = c.schema.parse(await readJson(req));
      const rec = { ...(await c.prepare(data, null)), id: newId() } as T;
      return ok(out(await db.put(c.col, rec)), 201);
    }),
  };
}

export function itemRoutes<T extends { id: string }>(c: Cfg<T>) {
  const out = (x: T) => (c.present ? c.present(x) : x);
  const find = async (ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params; const item = await db.get<T>(c.col, id);
    if (!item) throw new ApiError(404, "Not found"); return item;
  };
  return {
    GET: handle(async (_r, ctx) => {
      const item = await find(ctx); const admin = await getAdmin();
      if (!admin && c.visible && !c.visible(item)) throw new ApiError(404, "Not found");
      return ok(out(item));
    }),
    PUT: handle(async (req, ctx) => {
      await requireAdmin(); const prev = await find(ctx);
      const data = c.schema.parse(await readJson(req));
      const rec = { ...(await c.prepare(data, prev)), id: prev.id } as T;
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
