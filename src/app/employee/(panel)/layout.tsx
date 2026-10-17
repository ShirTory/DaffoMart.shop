import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getEmployee } from "@/server/riderAuth";
export const metadata: Metadata = { title: "Employee", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  if (!(await getEmployee())) redirect("/employee/login");
  return <>{children}</>;
}
