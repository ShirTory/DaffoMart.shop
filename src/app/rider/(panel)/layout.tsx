import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getRider } from "@/server/riderAuth";
export const metadata: Metadata = { title: "Rider", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  if (!(await getRider())) redirect("/rider/login");
  return <>{children}</>;
}
