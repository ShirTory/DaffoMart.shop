import { requireAdmin, usingDevCredentials } from "@/server/auth";
import { firebaseAdmin, firebaseConfigured, storageMode } from "@/server/db";
import { handle, ok } from "@/server/http";
import { gatewayInfo } from "@/server/payments";
import { imagesInDb } from "@/server/storage";
export const dynamic = "force-dynamic";

/** GET: storage mode. GET ?test=1: really talks to Firestore + Storage and reports the result. */
export const GET = handle(async (req) => {
  await requireAdmin();
  const mode = storageMode();
  const base = { storage: mode, persistent: mode === "firestore", devCredentials: usingDevCredentials(), vercel: Boolean(process.env.VERCEL || process.env.NETLIFY), gateway: gatewayInfo(), mapsKey: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
    firebase: { configured: firebaseConfigured(), projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "", bucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "" } };
  if (new URL(req.url).searchParams.get("test") !== "1") return ok(base);
  const test: { firestore: string; storage: string } = { firestore: "not configured", storage: "not configured" };
  if (firebaseConfigured()) {
    try {
      const { getFirestore } = await import("firebase-admin/firestore");
      const ref = getFirestore(await firebaseAdmin()).collection("_health").doc("ping");
      await ref.set({ at: new Date().toISOString() }); await ref.get(); await ref.delete();
      test.firestore = "OK";
    } catch (e: any) { test.firestore = `FAILED: ${String(e?.message ?? e).slice(0, 220)}`; }
    if (imagesInDb()) test.storage = "Not used — images are saved in the Firestore database (OK, no billing needed)";
    else try {
      const { getStorage } = await import("firebase-admin/storage");
      const [exists] = await getStorage(await firebaseAdmin()).bucket().exists();
      test.storage = exists ? "OK" : "FAILED: bucket not found (check FIREBASE_STORAGE_BUCKET)";
    } catch (e: any) { test.storage = `FAILED: ${String(e?.message ?? e).slice(0, 220)}`; }
  }
  return ok({ ...base, test });
});
