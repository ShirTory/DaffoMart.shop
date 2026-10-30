import { randomBytes, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { dataDir, firebaseAdmin, firebaseConfigured } from "./db";
import { ApiError } from "./http";
import { bucketConfigured } from "./storage";

export const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm" };
export const VIDEO_MAX_BUCKET = 60 * 1024 * 1024;   // direct-to-bucket upload (Firebase Storage)
export const VIDEO_MAX_LOCAL = 4 * 1024 * 1024;     // through the API (local development only; serverless hosts reject bigger bodies)
const NAME = /^[a-z0-9-]+\.(mp4|webm)$/;

/** Where uploads can go on this deployment. Videos are too big for the Firestore image store, so Firebase Storage is required in production. */
export function videoMode(): "bucket" | "local" | "none" {
  if (firebaseConfigured()) return bucketConfigured() ? "bucket" : "none";
  return "local";
}
const bucketOf = async () => { const { getStorage } = await import("firebase-admin/storage"); return getStorage(await firebaseAdmin()).bucket(); };

/** Step 1 (bucket mode): a short-lived signed URL the browser PUTs the file to, limited to this content type and size. */
export async function videoUploadUrl(contentType: string, size: number) {
  const ext = VIDEO_TYPES[contentType]; if (!ext) throw new ApiError(400, "Only MP4 or WebM videos can be uploaded.");
  if (!Number.isFinite(size) || size <= 0 || size > VIDEO_MAX_BUCKET) throw new ApiError(413, `The video must be ${VIDEO_MAX_BUCKET / 1024 / 1024} MB or smaller.`);
  const name = `${Date.now().toString(36)}-${randomBytes(5).toString("hex")}.${ext}`;
  const file = (await bucketOf()).file(`videos/${name}`);
  const [uploadUrl] = await file.getSignedUrl({ version: "v4", action: "write", expires: Date.now() + 15 * 60_000, contentType, extensionHeaders: { "x-goog-content-length-range": `1,${VIDEO_MAX_BUCKET}` } });
  return { uploadUrl, name, headers: { "Content-Type": contentType, "x-goog-content-length-range": `1,${VIDEO_MAX_BUCKET}` } };
}
/** Step 2: confirm the file really arrived with an allowed type/size, then give it a permanent download link. */
export async function finishVideoUpload(name: string) {
  if (!NAME.test(name)) throw new ApiError(400, "Invalid video name");
  const bucket = await bucketOf(); const file = bucket.file(`videos/${name}`);
  const [exists] = await file.exists(); if (!exists) throw new ApiError(404, "The upload did not arrive. Please try again.");
  const [m] = await file.getMetadata(); const size = Number(m.size);
  if (!VIDEO_TYPES[String(m.contentType)] || !(size > 0) || size > VIDEO_MAX_BUCKET) { await file.delete().catch(() => {}); throw new ApiError(400, "The uploaded file is not an allowed video."); }
  const token = randomUUID();
  await file.setMetadata({ cacheControl: "public, max-age=31536000, immutable", metadata: { firebaseStorageDownloadTokens: token } });
  return { url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(`videos/${name}`)}?alt=media&token=${token}`, size };
}

/** Local development: small videos through the API, kept in the data folder. Checks the real file signature, not just the declared type. */
export function sniffVideo(buf: Buffer): "mp4" | "webm" | null {
  if (buf.length > 12 && buf.subarray(4, 8).toString("latin1") === "ftyp") return "mp4";
  if (buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";
  return null;
}
export async function saveVideoLocal(buf: Buffer) {
  if (buf.length > VIDEO_MAX_LOCAL) throw new ApiError(413, `Through this server a video can be ${VIDEO_MAX_LOCAL / 1024 / 1024} MB at most.`);
  const ext = sniffVideo(buf); if (!ext) throw new ApiError(400, "This file is not a valid MP4 or WebM video.");
  const name = `${Date.now().toString(36)}-${randomBytes(5).toString("hex")}.${ext}`;
  const dir = path.join(dataDir(), "uploads", "videos"); await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, name), buf);
  return { url: `/api/uploads/video/${name}`, size: buf.length };
}
export async function readLocalVideo(name: string) {
  if (!NAME.test(name)) return null;
  try { return { data: await fs.promises.readFile(path.join(dataDir(), "uploads", "videos", name)), type: name.endsWith(".webm") ? "video/webm" : "video/mp4" }; } catch { return null; }
}
