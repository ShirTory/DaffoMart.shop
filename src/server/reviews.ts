import { createHash } from "crypto";
import { db } from "./db";
import { ApiError, clientIp, rateLimit } from "./http";
import { normPhone } from "@/lib/format";
import { inspectImage, saveImage } from "./storage";
import type { Order, Product, ProductReview, ReviewStatus } from "@/lib/types";

export const REVIEW_IMAGES_MAX = 3; export const REVIEW_IMAGE_BYTES = 1.5 * 1024 * 1024;
export const REVIEW_STATUSES: ReviewStatus[] = ["pending", "approved", "rejected", "hidden"];

/** "Rahim Uddin" -> "Rahim U." The shown name comes from the ORDER, never from what the reviewer types, so nobody can post as someone else. */
export const maskName = (full: string) => { const p = (full || "").trim().split(/\s+/).filter(Boolean); if (!p.length) return "Customer"; return p.length === 1 ? p[0].slice(0, 20) : `${p[0].slice(0, 20)} ${p[p.length - 1][0].toUpperCase()}.`; };

/** Public shape: no phone, no order id, no moderation notes. */
/** The stored id is "<orderId>_<productId>"; the public copy gets an opaque id so no order id ever leaves the server. */
export const publicReview = (r: ProductReview) => ({ id: createHash("sha1").update(r.id).digest("hex").slice(0, 16), name: r.name, rating: r.rating, title: r.title, text: r.text, images: r.images, verified: true as const, createdAt: r.createdAt });
export const reviewId = (orderId: string, productId: string) => `${orderId}_${productId}`;

/** Pure: stats of approved reviews. */
export function ratingStats(rs: Pick<ProductReview, "rating" | "status">[]) {
  const dist = [0, 0, 0, 0, 0]; let sum = 0, n = 0;
  for (const r of rs) if (r.status === "approved" && r.rating >= 1 && r.rating <= 5) { dist[r.rating - 1]++; sum += r.rating; n++; }
  return { count: n, average: n ? Math.round((sum / n) * 10) / 10 : 0, dist };
}
/** Keeps product.rating / reviewCount / ratingDist equal to the approved reviews (cards and structured data read these, so no extra queries are needed). */
export async function syncProductRating(productId: string) {
  const st = ratingStats(await db.find<ProductReview>("reviews", "productId", productId));
  await db.mutate<Product>("products", productId, (p) => {
    if (!p) return null;
    const n = { ...p } as Product;
    if (st.count) { n.rating = st.average; n.reviewCount = st.count; n.ratingDist = st.dist; } else { n.reviewCount = 0; delete n.ratingDist; }
    return n;
  });
  return st;
}

export async function listPublic(productId: string, offset = 0, limit = 5) {
  const all = (await db.find<ProductReview>("reviews", "productId", productId)).filter((r) => r.status === "approved").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { total: all.length, items: all.slice(offset, offset + limit).map(publicReview), stats: ratingStats(all) };
}

export interface ReviewInput { orderNo: string; phone: string; rating: number; title?: string; text: string }
/**
 * A review needs proof of purchase: the order number AND the phone used at checkout, on a DELIVERED order that contains this product.
 * One review per order line (the id is derived from order + product), so it cannot be repeated or posted for someone else's order.
 */
export async function submitReview(req: Request | null, productId: string, input: ReviewInput, files: Buffer[]) {
  if (req) rateLimit(`review:${clientIp(req)}`, 6, 10 * 60_000);
  const no = (input.orderNo || "").trim().toUpperCase(), phone = normPhone((input.phone || "").trim());
  if (!no || !phone) throw new ApiError(400, "Enter your order number and the phone number used for the order.");
  rateLimit(`review-order:${no}`, 8, 10 * 60_000);
  const rating = Number(input.rating), text = (input.text || "").trim(), title = (input.title || "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError(400, "Choose 1 to 5 stars.");
  if (text.length < 10 || text.length > 1500) throw new ApiError(400, "Write 10 to 1500 characters.");
  if (title.length > 80) throw new ApiError(400, "The headline can be 80 characters at most.");
  if (files.length > REVIEW_IMAGES_MAX) throw new ApiError(400, `You can add at most ${REVIEW_IMAGES_MAX} photos.`);
  const product = await db.get<Product>("products", productId);
  if (!product || !product.active) throw new ApiError(404, "Product not found");
  const order = (await db.find<Order>("orders", "orderNo", no)).find((o) => o.phone === phone);
  if (!order) throw new ApiError(404, "No order found with these details.");
  if (order.status !== "delivered") throw new ApiError(403, "You can review a product after your order has been delivered.");
  if (!order.items.some((i) => i.id === productId)) throw new ApiError(403, "This order does not include this product.");
  const id = reviewId(order.id, productId);
  if (await db.get("reviews", id)) throw new ApiError(409, "You have already reviewed this product for this order.");
  for (const f of files) { if (f.length > REVIEW_IMAGE_BYTES) throw new ApiError(413, "Each photo must be under 1.5 MB."); await inspectImage(f); }
  const images: string[] = []; for (const f of files) images.push((await saveImage(f, "review")).url);
  const now = new Date().toISOString(); let dup = false;
  await db.mutate<ProductReview>("reviews", id, (cur) => {
    if (cur) { dup = true; return null; }
    return { id, productId, orderId: order.id, phone, name: maskName(order.name), rating, ...(title ? { title } : {}), text, images, verified: true, status: "pending", createdAt: now, updatedAt: now };
  });
  if (dup) throw new ApiError(409, "You have already reviewed this product for this order.");
  return { id, status: "pending" as const };
}

export async function listAdmin(status?: string) {
  const all = await db.list<ProductReview>("reviews");
  const names = new Map((await db.list<Product>("products")).map((p) => [p.id, p.name]));
  return all.filter((r) => !status || r.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((r) => ({ ...r, phone: r.phone.length > 6 ? r.phone.slice(0, 3) + "•••••" + r.phone.slice(-3) : r.phone, productName: names.get(r.productId) || "(deleted product)" }));
}
export async function moderate(id: string, status: ReviewStatus, by: string, note?: string) {
  if (!REVIEW_STATUSES.includes(status)) throw new ApiError(400, "Unknown review status");
  const now = new Date().toISOString();
  const r = await db.mutate<ProductReview>("reviews", id, (c) => (c ? { ...c, status, adminNote: note?.slice(0, 300) || c.adminNote, moderatedBy: by, moderatedAt: now, updatedAt: now } : null));
  if (!r) throw new ApiError(404, "Review not found");
  await syncProductRating(r.productId);
  return r;
}
export async function removeReview(id: string) {
  const r = await db.get<ProductReview>("reviews", id); if (!r) throw new ApiError(404, "Review not found");
  await db.remove("reviews", id); await syncProductRating(r.productId);
}
