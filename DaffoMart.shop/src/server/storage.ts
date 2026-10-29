import { randomBytes, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { db, dataDir, firebaseAdmin, firebaseConfigured } from "./db";
import { ApiError } from "./http";

/** True only for images this site itself stored (local/DB upload route or our Firebase Storage). */
export const isOwnUpload = (u: string) => u.startsWith("/api/uploads/") || /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\//.test(u);

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // serverless hosts (Netlify/Vercel) reject request bodies of ~4.5-6 MB
const ALLOWED = new Set(["jpeg", "png", "webp", "gif", "avif"]);
const WIDTH: Record<string, number> = { product: 1200, banner: 2400, category: 600, offer: 1200, general: 1600 };

const MAX_FRAMES = 400; // animated GIF / WebP safety cap
const ANIM_WIDTH: Record<string, number> = { product: 800, banner: 1600, category: 400, offer: 1000, general: 1200 };

/** Encodes to WebP. Animated sources (GIF, animated WebP) keep every frame, timing and loop; still images are auto-rotated. */
async function encode(buf: Buffer, width: number, quality: number, animated: boolean) {
  const img = animated ? sharp(buf, { animated: true, failOn: "error" }) : sharp(buf, { failOn: "error" }).rotate();
  return img.resize({ width, withoutEnlargement: true }).webp({ quality, effort: animated ? 3 : 4 }).toBuffer();
}

/** Validates it is a real raster image, strips metadata, resizes and converts to WebP. GIF animations are preserved (animated WebP). */
export async function processImage(buf: Buffer, kind: string) {
  const info = await inspectImage(buf);
  const width = info.animated ? (ANIM_WIDTH[kind] ?? ANIM_WIDTH.general) : (WIDTH[kind] ?? WIDTH.general);
  return encode(buf, width, info.animated ? 78 : 82, info.animated);
}

/** Checks format, size and frame count. `animated` is true for GIF / WebP with more than one frame. */
export async function inspectImage(buf: Buffer) {
  let meta;
  try { meta = await sharp(buf, { failOn: "error", animated: true }).metadata(); } catch { throw new ApiError(400, "This file is not a valid image"); }
  if (!meta.format || !ALLOWED.has(meta.format)) throw new ApiError(400, "Only JPG, PNG, WebP, GIF or AVIF images are allowed");
  const frames = meta.pages ?? 1;
  if ((meta.width ?? 0) > 12000 || (meta.pageHeight ?? meta.height ?? 0) > 12000) throw new ApiError(400, "Image dimensions are too large");
  if (frames > MAX_FRAMES) throw new ApiError(400, `This animation has too many frames (${frames}). Please use one with ${MAX_FRAMES} frames or fewer.`);
  return { animated: frames > 1, frames };
}

/** Firebase Storage needs a billing (Blaze) account. Without FIREBASE_STORAGE_BUCKET the images are kept in the Firestore database instead (free Spark plan). */
export const bucketConfigured = () => Boolean(process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
export const imagesInDb = () => process.env.IMAGES_IN_DB === "true" || (firebaseConfigured() && !bucketConfigured());
const DB_IMAGE_MAX = 700 * 1024; // a Firestore document is limited to 1 MiB and base64 adds ~33 %

/** WebP, shrunk step by step until it fits in one database document. Animations keep playing; they are reduced in size and quality instead. */
async function fitForDb(buf: Buffer, kind: string) {
  const animated = (await inspectImage(buf)).animated;
  let width = animated ? (ANIM_WIDTH[kind] ?? ANIM_WIDTH.general) : (WIDTH[kind] ?? WIDTH.general), q = animated ? 70 : 80;
  for (let i = 0; i < (animated ? 12 : 8); i++) {
    const out = await encode(buf, width, q, animated);
    if (out.length <= DB_IMAGE_MAX) return out;
    if (q > (animated ? 40 : 55)) q -= 10; else width = Math.round(width * 0.8);
  }
  throw new ApiError(413, animated
    ? "This animation is too heavy to store in the database. Use a shorter or smaller GIF, or paste a link to a hosted GIF instead."
    : "This image is too detailed to store. Please upload a smaller image.");
}

export const MAX_NID_BYTES = 2.5 * 1024 * 1024;
/** Validates a NID photo and shrinks it to fit one private database document. Never published anywhere. */
export async function prepareNid(buf: Buffer) { await processImage(buf, "general"); return fitForDb(buf, "general"); }

export async function saveImage(buf: Buffer, kind = "general"): Promise<{ url: string; size: number; animated: boolean }> {
  const useDb = imagesInDb();
  const { animated } = await inspectImage(buf); // also validates the file
  const out = useDb ? await fitForDb(buf, kind) : await processImage(buf, kind);
  const name = `${Date.now().toString(36)}-${randomBytes(5).toString("hex")}.webp`;

  if (useDb) {
    await db.put("images", { id: name, data: out.toString("base64"), size: out.length, createdAt: new Date().toISOString() });
    return { url: `/api/uploads/${name}`, size: out.length, animated };
  }
  if (firebaseConfigured()) {
    const { getStorage } = await import("firebase-admin/storage");
    const bucket = getStorage(await firebaseAdmin()).bucket();
    const token = randomUUID();
    const file = bucket.file(`uploads/${name}`);
    await file.save(out, { resumable: false, metadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable", metadata: { firebaseStorageDownloadTokens: token } } });
    return { url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(`uploads/${name}`)}?alt=media&token=${token}`, size: out.length, animated };
  }
  const dir = path.join(dataDir(), "uploads");
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, name), out);
  return { url: `/api/uploads/${name}`, size: out.length, animated };
}

export async function readLocalUpload(name: string) {
  if (!/^[a-z0-9-]+\.webp$/.test(name)) return null;
  if (imagesInDb() || firebaseConfigured()) { const d = await db.get<{ data: string }>("images", name); if (d) return Buffer.from(d.data, "base64"); if (imagesInDb()) return null; } // images saved before a Storage bucket was added stay available
  try { return await fs.promises.readFile(path.join(dataDir(), "uploads", name)); } catch { return null; }
}
