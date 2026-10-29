import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import LimitedAccess from "@/components/admin/LimitedAccess";
import { getAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  // IT Support accounts the Owner has not granted full access to must not see (or be offered) business pages.
  if (!admin.fullAccess && admin.adminRole !== "accountant") return <LimitedAccess email={admin.email} />;
  return <AdminShell email={admin.email} role={admin.adminRole}>{children}</AdminShell>;
}
