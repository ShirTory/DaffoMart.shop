"use client";
import Link from "next/link";
import { ErrorBox, PageHeader, PageLoader, useList } from "@/components/admin/ui";

interface Ops {
  today: string;
  staff: { total: number; present: number; late: number; half: number; leave: number; absent: number; off: number; notMarked: number };
  orders: { pending: number; needsRider: number; needsCourier: number; withCourier: number; onTheWay: number; deliveredToday: number; unpaidOnline: number };
  ridersOnline: number; lowStock: number;
}
const Card = ({ href, label, value, tone = "gray", hint }: { href: string; label: string; value: number; tone?: "gray" | "red" | "amber" | "green" | "blue"; hint?: string }) => {
  const c = { gray: "text-gray-900", red: "text-red-600", amber: "text-amber-600", green: "text-emerald-600", blue: "text-primary" }[tone];
  return <Link href={href} className="card block p-4 transition hover:shadow-md"><p className={`text-3xl font-extrabold ${value > 0 || tone === "gray" || tone === "green" ? c : "text-gray-300"}`}>{value}</p><p className="mt-1 text-sm font-semibold">{label}</p>{hint && <p className="text-xs text-gray-500">{hint}</p>}</Link>;
};

export default function OperationsPage() {
  const { data: d, loading, error, reload } = useList<Ops>("/api/admin/operations");
  if (loading) return <PageLoader />; if (error || !d) return <ErrorBox msg={error || "Failed to load"} retry={reload} />;
  return (
    <>
      <PageHeader title="Operations" subtitle={`Today (${d.today}) — what needs your attention`} />
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Orders</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card href="/admin/orders" label="New orders to confirm" value={d.orders.pending} tone="amber" />
        <Card href="/admin/orders" label="Need a rider" value={d.orders.needsRider} tone="red" hint="Confirmed, inside Dhaka" />
        <Card href="/admin/orders" label="Need a courier" value={d.orders.needsCourier} tone="red" hint="Outside Dhaka" />
        <Card href="/admin/orders" label="Payments to verify" value={d.orders.unpaidOnline} tone="amber" hint="bKash / Nagad TrxID" />
        <Card href="/admin/live" label="Out for delivery" value={d.orders.onTheWay} tone="blue" />
        <Card href="/admin/orders" label="With couriers" value={d.orders.withCourier} tone="blue" />
        <Card href="/admin/orders" label="Delivered today" value={d.orders.deliveredToday} tone="green" />
        <Card href="/admin/inventory" label="Low / out of stock" value={d.lowStock} tone="amber" hint="5 or fewer left" />
      </div>
      <h2 className="mb-2 mt-8 text-sm font-bold uppercase tracking-wide text-gray-500">Team today</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card href="/admin/attendance" label="Present" value={d.staff.present + d.staff.late + d.staff.half} tone="green" hint={`of ${d.staff.total} staff${d.staff.late ? ` · ${d.staff.late} late` : ""}`} />
        <Card href="/admin/attendance" label="Absent" value={d.staff.absent} tone="red" />
        <Card href="/admin/attendance" label="On leave / off" value={d.staff.leave + d.staff.off} tone="blue" />
        <Card href="/admin/attendance" label="Not marked yet" value={d.staff.notMarked} tone="amber" hint="Open attendance to mark" />
        <Card href="/admin/live" label="Riders online (GPS)" value={d.ridersOnline} tone="green" />
      </div>
      <h2 className="mb-2 mt-8 text-sm font-bold uppercase tracking-wide text-gray-500">Manage</h2>
      <div className="flex flex-wrap gap-2 text-sm">
        {[["/admin/employees", "Staff"], ["/admin/attendance", "Attendance"], ["/admin/riders", "Riders"], ["/admin/couriers", "Courier services"], ["/admin/delivery", "Delivery areas"], ["/admin/invoice-settings", "Invoice design"]].map(([h, l]) => <Link key={h} href={h} className="btn-outline">{l}</Link>)}
      </div>
    </>
  );
}
