import { randomBytes, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { db, dataDir, firebaseAdmin, firebaseConfigured } from "./db";
import { ApiError } from "./http";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // serverless hosts (Netlify/Vercel) reject request bodies of ~4.5-6 MB
const ALLOWED = new Set(["jpeg", "png", "webp", "gif", "avif"]);
const WIDTH: Record<string, number> = { product: 1200, banner: 2400, category: 600, offer: 1200, general: 1600 };

/** Validates it is a real raster image, strips metadata, resizes and converts to WebP. */
export async function processImage(buf: Buffer, kind: string) {
  let meta;
  try { meta = await sharp(buf, { failOn: "error" }).metadata(); } catch { throw new ApiError(400, "This file is not a valid image"); }
  if (!meta.format || !ALLOWED.has(meta.format)) throw new ApiError(400, "Only JPG, PNG, WebP, GIF or AVIF images are allowed");
  if ((meta.width ?? 0) > 12000 || (meta.height ?? 0) > 12000) throw new ApiError(400, "Image dimensions are too large");
  return sharp(buf).rotate().resize({ width: WIDTH[kind] ?? WIDTH.general, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
}

/** Firebase Storage needs a billing (Blaze) account. Without FIREBASE_STORAGE_BUCKET the images are kept in the Firestore database instead (free Spark plan). */
export const bucketConfigured = () => Boolean(process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
export const imagesInDb = () => process.env.IMAGES_IN_DB === "true" || (firebaseConfigured() && !bucketConfigured());
const DB_IMAGE_MAX = 700 * 1024; // a Firestore document is limited to 1 MiB and base64 adds ~33 %

/** WebP, shrunk step by step until it fits in one database document. */
async function fitForDb(buf: Buffer, kind: string) {
  let width = WIDTH[kind] ?? WIDTH.general, q = 80;
  for (let i = 0; i < 8; i++) {
    const out = await sharp(buf).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: q }).toBuffer();
    if (out.length <= DB_IMAGE_MAX) return out;
    if (q > 55) q -= 10; else width = Math.round(width * 0.8);
  }
  throw new ApiError(413, "This image is too detailed to store. Please upload a smaller image.");
}

export const MAX_NID_BYTES = 2.5 * 1024 * 1024;
/** Validates a NID photo and shrinks it to fit one private database document. Never published anywhere. */
export async function prepareNid(buf: Buffer) { await processImage(buf, "general"); return fitForDb(buf, "general"); }

export async function saveImage(buf: Buffer, kind = "general"): Promise<{ url: string; size: number }> {
  const useDb = imagesInDb();
  const out = useDb ? (await processImage(buf, kind), await fitForDb(buf, kind)) : await processImage(buf, kind); // processImage also validates the file
  const name = `${Date.now().toString(36)}-${randomBytes(5).toString("hex")}.webp`;

  if (useDb) {
    await db.put("images", { id: name, data: out.toString("base64"), size: out.length, createdAt: new Date().toISOString() });
    return { url: `/api/uploads/${name}`, size: out.length };
  }
  if (firebaseConfigured()) {
    const { getStorage } = await import("firebase-admin/storage");
    const bucket = getStorage(await firebaseAdmin()).bucket();
    const token = randomUUID();
    const file = bucket.file(`uploads/${name}`);
    await file.save(out, { resumable: false, metadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable", metadata: { firebaseStorageDownloadTokens: token } } });
    return { url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(`uploads/${name}`)}?alt=media&token=${token}`, size: out.length };
  }
  const dir = path.join(dataDir(), "uploads");
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, name), out);
  return { url: `/api/uploads/${name}`, size: out.length };
}

export async function readLocalUpload(name: string) {
  if (!/^[a-z0-9-]+\.webp$/.test(name)) return null;
  if (imagesInDb() || firebaseConfigured()) { const d = await db.get<{ data: string }>("images", name); if (d) return Buffer.from(d.data, "base64"); if (imagesInDb()) return null; } // images saved before a Storage bucket was added stay available
  try { return await fs.promises.readFile(path.join(dataDir(), "uploads", name)); } catch { return null; }
}
