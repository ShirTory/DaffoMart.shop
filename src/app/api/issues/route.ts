import { db, newId } from "@/server/db";
import { ApiError, clientIp, handle, ok, rateLimit } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { getRider } from "@/server/riderAuth";
import { normPhone } from "@/lib/format";
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
  if (d.raisedBy === "rider") { // only the signed-in rider of THIS order
    const rider = await getRider();
    if (!rider || rider.id !== order.riderId) throw new ApiError(403, "You can only report issues on your own deliveries");
  } else if (normPhone(d.raiserPhone ?? "") !== order.phone) throw new ApiError(403, "Enter the phone number used for this order"); // customer ownership
  if (form.get("video") instanceof File && (form.get("video") as File).size) throw new ApiError(400, "Video upload is not supported. Please attach photos instead.");

  const photos: string[] = [];
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 5) throw new ApiError(400, "You can attach up to 5 photos");
  for (const f of files) {
    if (f.size > MAX_UPLOAD_BYTES) throw new ApiError(413, `Each photo must be under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`);
    const r = await saveImage(Buffer.from(await f.arrayBuffer()), "issue");
    photos.push(r.url);
  }
  const video: string | undefined = undefined;

  const at = new Date().toISOString();
  const rec: OrderIssue = {
    id: newId(), orderId: order.id, orderNo: order.orderNo,
    raisedBy: d.raisedBy, raiserName: d.raiserName || order.name, raiserPhone: order.phone,
    text: d.text, photos, video, status: "open", createdAt: at, updatedAt: at,
  };
  await db.put("issues", rec);
  return ok(rec, 201);
});
