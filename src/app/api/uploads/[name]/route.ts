import { readLocalUpload } from "@/server/storage";
export const dynamic = "force-dynamic";
export async function GET(_r: Request, ctx: { params: Promise<{ name: string }> }) {
  const buf = await readLocalUpload((await ctx.params).name);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" } });
}
