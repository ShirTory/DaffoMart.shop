/** Remembers the customer's delivery details on THIS device only (no account needed) so the next order takes seconds. Never stores payment data. */
const KEY = "daffomart-customer";
export type SavedCustomer = { name?: string; phone?: string; address?: string; zone?: string };
export function loadSavedCustomer(): SavedCustomer {
  if (typeof window === "undefined") return {};
  try { const d = JSON.parse(localStorage.getItem(KEY) || "{}"); return { name: String(d.name ?? ""), phone: String(d.phone ?? ""), address: String(d.address ?? ""), zone: String(d.zone ?? "") }; } catch { return {}; }
}
export function saveCustomer(c: SavedCustomer) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* private mode */ } }
