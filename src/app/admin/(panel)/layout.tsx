import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return <AdminShell email={admin.email}>{children}</AdminShell>;
}
