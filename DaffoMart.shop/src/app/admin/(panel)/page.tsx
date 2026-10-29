"use client";
import Link from "next/link";
import { useState } from "react";
import SalesChart from "@/components/admin/SalesChart";
import { ErrorBox, Icon, PageHeader, PageLoader, StatusBadge, Thumb, useList } from "@/components/admin/ui";
import { fmtDateTime, statusLabel, taka } from "@/lib/format";
import type { Order } from "@/lib/types";

interface Stats {
  totals: { revenue: number; sales: number; orders: number; pending: number; todayOrders: number; todaySales: number; customers: number; avgOrder: number; products: number; activeProducts: number; outOfStock: number };
  trend: number; series: { date: string; orders: number; sales: number }[]; statusBreakdown: Record<string, number>;
  topProducts: { id: string; name: string; image?: string; emoji?: string; qty: number; revenue: number }[];
  lowStock: { id: string; name: string; stock: number; image?: string; emoji?: string; unit: string }[];
  recentOrders: Order[];
}
interface Sys { storage: string; persistent: boolean; devCredentials: boolean; vercel: boolean }

export default function Dashboard() {
  const [days, setDays] = useState(14);
  const { data, loading, error, reload } = useList<Stats>(`/api/admin/stats?days=${days}`);
  const sys = useList<Sys>("/api/admin/system").data;
  if (loading && !data) return <PageLoader />;
  if (error || !data) return <ErrorBox msg={error || "Could not load stats"} retry={reload} />;
  const t = data.totals;
  const cards = [
    { l: "Today's sales", v: taka(t.todaySales), s: `${t.todayOrders} order${t.todayOrders === 1 ? "" : "s"} today`, i: "cash", c: "bg-emerald-50 text-emerald-600" },
    { l: "Total sales", v: taka(t.sales), s: `${taka(t.revenue)} delivered`, i: "trend", c: "bg-blue-50 text-blue-600", trend: data.trend },
    { l: "Orders", v: String(t.orders), s: `${t.pending} pending`, i: "orders", c: "bg-amber-50 text-amber-600" },
    { l: "Customers", v: String(t.customers), s: `Avg. order ${taka(t.avgOrder)}`, i: "users", c: "bg-violet-50 text-violet-600" },
  ];
  const maxStatus = Math.max(1, ...Object.values(data.statusBreakdown));
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of your store performance"><Link href="/admin/products" className="btn-primary"><Icon name="plus" className="h-4 w-4" />Add product</Link></PageHeader>

      {sys && !sys.persistent && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-semibold">Using temporary local storage</p>
            <p className="mt-0.5 text-amber-800">{sys.vercel ? "On Netlify/Vercel, data and uploaded images are erased regularly. " : "Data is saved in the .data folder on this machine. "}Add the Firebase service-account variables (see DEPLOYMENT.md) to store data and images permanently. <Link href="/admin/settings" className="font-semibold underline">Check Firebase status →</Link></p></div>
        </div>)}
      {sys?.devCredentials && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">You are using the default development login. Set <code className="font-mono">ADMIN_EMAIL</code>, <code className="font-mono">ADMIN_PASSWORD</code> and <code className="font-mono">AUTH_SECRET</code> before going live.</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.l} className="card p-5">
            <div className="flex items-center justify-between"><p className="text-sm font-medium text-gray-500">{c.l}</p><span className={`rounded-lg p-2 ${c.c}`}><Icon name={c.i} className="h-5 w-5" /></span></div>
            <p className="mt-3 text-2xl font-bold tracking-tight">{c.v}</p>
            <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">{c.s}{"trend" in c && c.trend !== undefined && <span className={`font-semibold ${c.trend >= 0 ? "text-emerald-600" : "text-red-600"}`}>{c.trend >= 0 ? "▲" : "▼"} {Math.abs(c.trend)}%</span>}</p>
          </div>))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between"><div><h2 className="font-bold">Sales overview</h2><p className="text-xs text-gray-500">Excluding cancelled &amp; returned orders</p></div>
            <div className="flex rounded-lg bg-gray-100 p-0.5 text-xs font-semibold">{[7, 14, 30].map((d) => <button key={d} onClick={() => setDays(d)} className={`rounded-md px-3 py-1.5 ${days === d ? "bg-white text-primary shadow-sm" : "text-gray-500"}`}>{d}d</button>)}</div></div>
          <SalesChart data={data.series} />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-bold">Orders by status</h2>
          <ul className="space-y-3">
            {Object.entries(data.statusBreakdown).map(([s, n]) => (
              <li key={s}><div className="mb-1 flex justify-between text-xs"><span className="font-medium text-gray-600">{statusLabel(s)}</span><span className="font-semibold">{n}</span></div>
                <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-primary" style={{ width: `${(n / maxStatus) * 100}%` }} /></div></li>))}
          </ul>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Top selling products</h2></div>
          {data.topProducts.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">No sales yet.</p> : (
            <ul className="divide-y">{data.topProducts.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3"><Thumb src={p.image} emoji={p.emoji} className="h-11 w-11" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.name}</p><p className="text-xs text-gray-500">{p.qty} sold</p></div><p className="text-sm font-bold">{taka(p.revenue)}</p></li>))}</ul>)}
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Low stock alerts</h2><Link href="/admin/inventory" className="text-xs font-semibold text-primary">Manage inventory →</Link></div>
          {data.lowStock.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">All products are well stocked.</p> : (
            <ul className="divide-y">{data.lowStock.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3"><Thumb src={p.image} emoji={p.emoji} className="h-11 w-11" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.name}</p><p className="text-xs text-gray-500">{p.unit}</p></div>
                <StatusBadge status={p.stock <= 0 ? "out" : "low"} label={p.stock <= 0 ? "Out of stock" : `${p.stock} left`} /></li>))}</ul>)}
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3"><h2 className="font-bold">Recent orders</h2><Link href="/admin/orders" className="text-xs font-semibold text-primary">View all →</Link></div>
        {data.recentOrders.length === 0 ? <p className="py-10 text-center text-sm text-gray-500">No orders yet. They will appear here as soon as customers check out.</p> : (
          <div className="scroll-thin overflow-x-auto"><table className="w-full"><thead className="bg-gray-50"><tr><th className="th">Order</th><th className="th">Customer</th><th className="th">Date</th><th className="th">Total</th><th className="th">Status</th></tr></thead>
            <tbody className="divide-y">{data.recentOrders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50"><td className="td font-semibold text-primary"><Link href={`/admin/orders?open=${o.id}`}>{o.orderNo}</Link></td><td className="td">{o.name}<p className="text-xs text-gray-500">{o.phone}</p></td>
                <td className="td whitespace-nowrap text-gray-500">{fmtDateTime(o.createdAt)}</td><td className="td font-semibold">{taka(o.total)}</td><td className="td"><StatusBadge status={o.status} /></td></tr>))}</tbody></table></div>)}
      </div>
    </>
  );
}
