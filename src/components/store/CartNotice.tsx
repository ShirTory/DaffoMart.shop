"use client";
import { useCartNotice } from "@/lib/hooks";

/** Shows why cart lines were removed or reduced (sold out / stock changed). */
export default function CartNotice() {
  const { messages, set } = useCartNotice();
  if (!messages.length) return null;
  return (
    <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      {messages.map((m) => <p key={m}>{m}</p>)}
      <button type="button" className="mt-1 text-xs font-semibold underline" onClick={() => set([])}>Dismiss</button>
    </div>
  );
}
