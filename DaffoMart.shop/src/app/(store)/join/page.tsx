import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/server/queries";
export const metadata: Metadata = { title: "Join our team", alternates: { canonical: "/join" } };
export const revalidate = 60; // refreshed when the admin saves (and at most every 60 s)

export default async function JoinPage() {
  const s = await getSettings();
  const open = (s.positions ?? []).filter((p) => p.active && p.title.trim());
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">{s.joinTitle || "Join our team"}</h1>
      <p className="mt-1 text-sm text-gray-500">{s.joinIntro || "Choose the position you want to apply for."}</p>

      {open.length === 0 ? (
        <div className="mt-6 rounded-2xl border bg-white p-8 text-center shadow-card">
          <p className="font-semibold">No positions are open right now</p>
          <p className="mt-1 text-sm text-gray-500">Please check back later.</p>
          <Link href="/" className="btn-primary mt-4 inline-flex">Back to store</Link>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {open.map((p) => (
            <section key={p.id} className="flex flex-col rounded-2xl border bg-white p-5 shadow-card">
              <h2 className="font-bold">{p.title}</h2>
              {p.description && <p className="mt-1 flex-1 text-sm text-gray-500">{p.description}</p>}
              <Link
                href={p.kind === "rider" ? "/rider/register" : `/employee/register?position=${encodeURIComponent(p.title)}`}
                className="btn-primary mt-4 inline-flex justify-center"
              >
                Apply for this position
              </Link>
            </section>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-sm text-gray-500">
        Already applied? <a href="/rider/login" className="font-semibold text-primary">Rider sign in</a> · <a href="/employee/login" className="font-semibold text-primary">Staff sign in</a>
      </p>
    </div>
  );
}
