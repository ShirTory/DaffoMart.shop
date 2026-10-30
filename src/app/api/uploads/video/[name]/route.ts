import { readLocalVideo } from "@/server/video";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Local-development video files, with Range support so the player can seek. */
export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const f = await readLocalVideo((await ctx.params).name);
  if (!f) return new Response("Not found", { status: 404 });
  const size = f.data.length; const h = { "Content-Type": f.type, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
  if (m && (m[1] || m[2])) {
    let s = m[1] ? parseInt(m[1], 10) : size - parseInt(m[2], 10), e = m[1] && m[2] ? parseInt(m[2], 10) : size - 1;
    s = Math.max(0, s); e = Math.min(size - 1, e);
    if (s > e) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new Response(new Uint8Array(f.data.subarray(s, e + 1)), { status: 206, headers: { ...h, "Content-Range": `bytes ${s}-${e}/${size}`, "Content-Length": String(e - s + 1) } });
  }
  return new Response(new Uint8Array(f.data), { headers: { ...h, "Content-Length": String(size) } });
}
