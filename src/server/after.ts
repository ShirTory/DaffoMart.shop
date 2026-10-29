/** Runs background work after the HTTP response is sent (Next.js `after`), so slow third-party calls never delay the customer. Falls back to fire-and-forget outside Next (tests, scripts). */
export function runAfterResponse(task: () => Promise<unknown>) {
  const safe = () => task().catch((e) => console.error("[after] background task failed", e));
  import("next/server").then((m: any) => { if (typeof m.after === "function") { try { m.after(safe); return; } catch { /* called outside a request scope */ } } void safe(); }).catch(() => void safe());
}
