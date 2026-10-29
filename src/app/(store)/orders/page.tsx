"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { fmtDateTime, statusLabel, taka } from "@/lib/format";
import { useCart } from "@/lib/store";
import { saveLastOrder } from "@/lib/lastOrder";

interface Row {
  orderNo: string; status: string; createdAt: string; total: number; itemCount: number;
  items: { id: string; variantId?: string; variantLabel?: string; name: string; qty: number; price: number; unit: string; image?: string; emoji?: string }[];
  riderName?: string; payment?: string; paymentStatus?: string;
}

export default function MyOrdersPage() {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const [phone, setPhone] = useState("");
  const [list, setList] = useState<Row[] | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const load = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true); setErr(""); setList(null);
    try {
      const data = await api<Row[]>(`/api/orders/my?phone=${encodeURIComponent(phone.trim())}`);
      setList(data);
      if (data?.[0]?.items?.length) saveLastOrder(data[0].orderNo, data[0].items as any);
    } catch (ex: any) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  const reorder = (row: Row) => {
    saveLastOrder(row.orderNo, row.items as any);
    for (const i of row.items) {
      add({ id: i.id, slug: i.id, name: i.name, price: i.price, unit: i.unit, emoji: i.emoji || "🛒", image: i.image, ...(i.variantId ? { vid: i.variantId, vlabel: i.variantLabel } : {}) }, i.qty);
    }
    router.push("/cart");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">My orders</h1>
      <p className="mt-1 text-sm text-gray-500">Enter the mobile number you used at checkout to see recent orders.</p>
      <form onSubmit={load} className="mt-5 flex flex-col gap-3 rounded-2xl border bg-white p-5 shadow-card sm:flex-row">
        <input className="input flex-1" placeholder="01XXXXXXXXX" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} required aria-label="Mobile number" />
        <button className="btn-primary" disabled={busy}>{busy ? "Loading…" : "View orders"}</button>
      </form>
      {err && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{err}</p>}
      {list && list.length === 0 && (
        <p className="mt-6 rounded-2xl border bg-white p-10 text-center text-gray-500">No orders found for this number.</p>
      )}
      {list && list.length > 0 && (
        <ul className="mt-5 space-y-3">
          {list.map((o) => (
            <li key={o.orderNo} className="rounded-2xl border bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold text-primary">{o.orderNo}</p>
                  <p className="text-xs text-gray-500">{fmtDateTime(o.createdAt)} · {o.itemCount} item{o.itemCount !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{statusLabel(o.status)}</p>
                  <p className="font-bold">{taka(o.total)}</p>
                </div>
              </div>
              {o.riderName && <p className="mt-2 text-xs text-gray-600">Rider: {o.riderName}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/track?no=${encodeURIComponent(o.orderNo)}&phone=${encodeURIComponent(phone.trim())}`} className="btn-primary btn-sm">Track</Link>
                <button type="button" className="btn-outline btn-sm" onClick={() => reorder(o)}>Reorder</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
