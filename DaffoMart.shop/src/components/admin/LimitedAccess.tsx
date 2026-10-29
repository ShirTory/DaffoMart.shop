"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

/** Shown to IT Support accounts that have not been granted full Admin Panel access by the Owner. */
export default function LimitedAccess({ email }: { email: string }) {
  const router = useRouter();
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/admin/login");
    router.refresh();
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-card">
        <h1 className="text-xl font-bold text-gray-900">Admin access not granted</h1>
        <p className="mt-2 text-sm text-gray-600">
          <b>{email}</b> is signed in as IT Support without full Admin Panel access. Ask the Owner to grant access from
          Admin → IT Support. Until then you can only use the system diagnostics endpoints.
        </p>
        <button onClick={logout} className="btn-primary mt-6 w-full py-2.5">Sign out</button>
      </div>
    </div>
  );
}
