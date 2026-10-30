"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Icon, ToastProvider } from "./ui";

const NAV: { href: string; label: string; icon: string; section?: string }[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", section: "Overview" },
  { href: "/admin/operations", label: "Operations", icon: "ops" },
  { href: "/admin/orders", label: "Orders", icon: "orders", section: "Sales" },
  { href: "/admin/customers", label: "Customers (CRM)", icon: "users" },
  { href: "/admin/finance", label: "Finance", icon: "trend" },
  { href: "/admin/finance/payroll", label: "Staff Payroll", icon: "users" },
  { href: "/admin/finance/rider-earnings", label: "Rider Earnings", icon: "rider" },
  { href: "/admin/finance/purchases", label: "Purchases & Suppliers", icon: "inventory" },
  { href: "/admin/finance/balances", label: "Balances & Dues", icon: "trend" },
  { href: "/admin/finance/courier", label: "Courier Accounts", icon: "delivery" },
  { href: "/admin/finance/analytics", label: "Profit & Ads", icon: "trend" },
  { href: "/admin/issues", label: "Issues", icon: "alert" },
  { href: "/admin/products", label: "Products", icon: "products" },
  { href: "/admin/categories", label: "Categories", icon: "categories" },
  { href: "/admin/inventory", label: "Inventory", icon: "inventory" },
  { href: "/admin/offers", label: "Offers & Coupons", icon: "offers" },
  { href: "/admin/delivery", label: "Delivery Areas", icon: "delivery", section: "Delivery" },
  { href: "/admin/riders", label: "Riders", icon: "rider" },
  { href: "/admin/live", label: "Live Map", icon: "delivery" },
  { href: "/admin/couriers", label: "Courier Services", icon: "delivery" },
  { href: "/admin/employees", label: "Staff", icon: "users", section: "Team" },
  { href: "/admin/attendance", label: "Attendance", icon: "calendar" },
  { href: "/admin/theme", label: "Website Theme", icon: "palette", section: "Website" },
  { href: "/admin/appearance", label: "Appearance", icon: "palette" },
  { href: "/admin/texts", label: "Website Text", icon: "text" },
  { href: "/admin/content", label: "Website Content", icon: "content" },
  { href: "/admin/covers", label: "Cover Images", icon: "covers" },
  { href: "/admin/payments", label: "Payments", icon: "trend" },
  { href: "/admin/invoice-settings", label: "Invoice", icon: "invoice" },
  { href: "/admin/integrations", label: "WhatsApp & Calling", icon: "phone", section: "Integrations" },
  { href: "/admin/data-transfer", label: "Excel Import/Export", icon: "upload" },
  { href: "/admin/it-support", label: "IT Support", icon: "users", section: "Security" },
  { href: "/admin/audit", label: "Audit logs", icon: "ops" },
  { href: "/admin/settings", label: "Settings & Contact", icon: "settings" },
];

/** An Accountant only sees (and may only open) the Finance pages; the API enforces the same boundary. */
const isFinancePath = (p: string) => p === "/admin/finance" || p.startsWith("/admin/finance/");

export default function AdminShell({ email, role, children }: { email: string; role?: string; children: React.ReactNode }) {
  const accountant = role === "accountant";
  const path = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(0);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => { if (accountant && !isFinancePath(path)) router.replace("/admin/finance"); }, [accountant, path, router]);
  useEffect(() => { if (accountant) return; api<{ count: number }>("/api/admin/riders-pending").then((r) => setPending(r.count)).catch(() => {}); }, [path]); // new rider applications waiting for approval
  const nav = accountant ? NAV.filter((n) => isFinancePath(n.href)) : NAV;
  const active = (h: string) => (h === "/admin" ? path === h : h === "/admin/finance" ? path === h : path === h || path.startsWith(h + "/"));
  const logout = async () => { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); router.replace("/admin/login"); router.refresh(); };
  const current = nav.find((n) => active(n.href))?.label ?? "Admin";

  const Sidebar = (
    <div className="flex h-full flex-col bg-primary-deeper text-white">
      <div className="px-5 pb-4 pt-5">
        <div className="rounded-xl bg-white px-3 py-2.5"><Image src="/logo-horizontal.png" alt="DaffoMart" width={778} height={168} className="h-9 w-auto" priority /></div>
        <p className="mt-3 px-1 text-[11px] font-semibold uppercase tracking-widest text-white/40">Admin Panel</p>
      </div>
      <nav className="scroll-thin flex-1 space-y-1 overflow-y-auto px-3">
        {nav.map((n) => (
          <div key={n.href}>
            {n.section && <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-white/35">{n.section}</p>}
          <Link href={n.href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${active(n.href) ? "bg-accent text-white shadow" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
            <Icon name={n.icon} className="h-[18px] w-[18px]" />{n.label}
            {n.href === "/admin/riders" && pending > 0 && <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white" title="Rider applications waiting for approval">{pending}</span>}
          </Link></div>))}
      </nav>
      <div className="space-y-1 border-t border-white/10 p-3">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"><Icon name="external" className="h-[18px] w-[18px]" />View storefront</Link>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"><Icon name="out" className="h-[18px] w-[18px]" />Sign out</button>
      </div>
    </div>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-100">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{Sidebar}</aside>
        {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} /><aside className="fade-in absolute inset-y-0 left-0 w-64">{Sidebar}</aside></div>}
        <div className="lg:pl-64">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white/90 px-4 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3">
              <button className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
              <span className="text-sm font-semibold text-gray-700">{current}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-gray-500 sm:block">{email}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{email.charAt(0).toUpperCase()}</span>
            </div>
          </header>
          <main className="mx-auto max-w-[1400px] p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
