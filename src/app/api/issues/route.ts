import { db, newId } from "@/server/db";
import { ApiError, clientIp, handle, ok, rateLimit } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { MAX_UPLOAD_BYTES, saveImage } from "@/server/storage";
import { issueCreateSchema } from "@/lib/validators";
import type { Order, OrderIssue } from "@/lib/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = handle(async (req) => {
  await requireAdmin();
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId") || undefined;
  const status = url.searchParams.get("status") || undefined;
  let list = await db.list<OrderIssue>("issues");
  if (orderId) list = list.filter((i) => i.orderId === orderId);
  if (status) list = list.filter((i) => i.status === status);
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return ok(list);
});

export const POST = handle(async (req) => {
  rateLimit(`issue:${clientIp(req)}`, 10, 60 * 60_000);
  const form = await req.formData().catch(() => { throw new ApiError(400, "Send as multipart/form-data"); });
  const text = (k: string) => { const v = form.get(k); return typeof v === "string" ? v : ""; };
  const d = issueCreateSchema.parse({
    orderId: text("orderId"),
    raisedBy: text("raisedBy") as "customer" | "rider",
    text: text("text"),
    raiserName: text("raiserName") || undefined,
    raiserPhone: text("raiserPhone") || undefined,
  });
  const order = await db.get<Order>("orders", d.orderId);
  if (!order) throw new ApiError(404, "Order not found");

  const photos: string[] = [];
  for (const f of form.getAll("photos")) {
    if (!(f instanceof File) || !f.size) continue;
    if (f.size > MAX_UPLOAD_BYTES) throw new ApiError(413, `Each photo must be under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`);
    const r = await saveImage(Buffer.from(await f.arrayBuffer()), "issue");
    photos.push(r.url);
  }
  let video: string | undefined;
  const vid = form.get("video");
  if (vid instanceof File && vid.size && vid.size <= 25 * 1024 * 1024) {
    try {
      const r = await saveImage(Buffer.from(await vid.arrayBuffer()), "issue-video");
      video = r.url;
    } catch { /* optional */ }
  }

  const at = new Date().toISOString();
  const rec: OrderIssue = {
    id: newId(), orderId: order.id, orderNo: order.orderNo,
    raisedBy: d.raisedBy, raiserName: d.raiserName || order.name, raiserPhone: d.raiserPhone || order.phone,
    text: d.text, photos, video, status: "open", createdAt: at, updatedAt: at,
  };
  await db.put("issues", rec);
  return ok(rec, 201);
});
