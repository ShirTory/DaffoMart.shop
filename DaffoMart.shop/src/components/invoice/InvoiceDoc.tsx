import type { Order, StoreSettings } from "@/lib/types";
import { PAYMENT_LABEL } from "@/lib/types";
import { fmtDateTime, taka } from "@/lib/format";
import { invoiceNo, resolveInvoice } from "@/lib/invoice";

const PAPER: Record<string, string> = { A4: "max-w-[794px]", A5: "max-w-[560px]", thermal: "max-w-[320px]" };

/** One invoice, used for the customer link, the admin print view and the live preview in Admin → Invoice. Look and wording come from settings.invoice. */
export default function InvoiceDoc({ order: o, settings: s }: { order: Order; settings: StoreSettings }) {
  const v = resolveInvoice(s); const thermal = v.paper === "thermal"; const modern = v.layout === "modern" && !thermal;
  const paid = o.paymentStatus === "paid";
  const row = (label: string, val: string, strong = false, color?: string) => (
    <div className={`flex justify-between gap-6 ${strong ? "border-t pt-2 text-base font-bold" : ""}`} style={strong ? { color: v.accent } : color ? { color } : undefined}><span className={strong ? "" : "text-gray-500"}>{label}</span><span>{val}</span></div>
  );
  return (
    <div className={`invoice-doc relative mx-auto w-full ${PAPER[v.paper] ?? PAPER.A4} bg-white text-gray-900 ${thermal ? "p-3 text-[11px]" : "p-6 text-sm sm:p-10"}`}>
      {/* header */}
      <div className={`flex ${thermal ? "flex-col items-center text-center" : "items-start justify-between"} gap-4 ${modern ? "-mx-6 -mt-6 mb-6 px-6 py-6 text-white sm:-mx-10 sm:-mt-10 sm:px-10" : "border-b pb-5"}`} style={modern ? { background: v.accent } : { borderColor: v.accent }}>
        <div className={`flex items-center gap-3 ${thermal ? "flex-col" : ""}`}>
          {v.showLogo && (v.logo || s.logo) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.logo || s.logo} alt={v.companyName} className={`${thermal ? "h-10" : "h-12"} w-auto max-w-[160px] object-contain ${modern ? "rounded bg-white p-1" : ""}`} />
          )}
          <div>
            <p className={`font-extrabold ${thermal ? "text-sm" : "text-lg"}`} style={modern ? undefined : { color: v.accent }}>{v.companyName}</p>
            {v.address && <p className={`whitespace-pre-line text-xs ${modern ? "text-white/85" : "text-gray-500"}`}>{v.address}</p>}
            <p className={`text-xs ${modern ? "text-white/85" : "text-gray-500"}`}>{[v.phone, v.email, v.website].filter(Boolean).join(" · ")}</p>
            {v.taxId && <p className={`text-xs ${modern ? "text-white/85" : "text-gray-500"}`}>{v.taxLabel || "Tax ID"}: {v.taxId}</p>}
          </div>
        </div>
        <div className={thermal ? "" : "text-right"}>
          <p className={`font-black tracking-wider ${thermal ? "text-base" : "text-2xl"}`} style={modern ? undefined : { color: v.accent }}>{v.title}</p>
          <p className="font-semibold">{invoiceNo(o, v.prefix)}</p>
          <p className={`text-xs ${modern ? "text-white/85" : "text-gray-500"}`}>Order {o.orderNo}</p>
          <p className={`text-xs ${modern ? "text-white/85" : "text-gray-500"}`}>{fmtDateTime(o.createdAt)}</p>
        </div>
      </div>

      {/* parties */}
      <div className={`mt-5 grid gap-4 ${thermal ? "" : "sm:grid-cols-2"}`}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Bill to</p>
          <p className="font-semibold">{o.name}</p>
          {v.showCustomerPhone && <p className="text-gray-600">{o.phone}</p>}
          <p className="whitespace-pre-line text-gray-600">{o.address}</p>
        </div>
        <div className={thermal ? "" : "sm:text-right"}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Delivery</p>
          <p className="text-gray-600">{o.zoneName || o.zone}</p>
          {v.showCourier && o.courierName && <p className="text-gray-600">Courier: {o.courierName}{o.trackingNo ? ` · ${o.trackingNo}` : ""}</p>}
          {o.riderName && !o.courierName && <p className="text-gray-600">Rider: {o.riderName}</p>}
          {v.showPaymentInfo && <p className="text-gray-600">Payment: {o.paymentLabel ?? PAYMENT_LABEL[o.payment] ?? o.payment} · <b className={paid ? "text-emerald-700" : "text-amber-700"}>{paid ? "Paid" : (o.paymentStatus ?? "unpaid").replace(/^./, (c) => c.toUpperCase())}</b>{o.paymentRef ? ` · TrxID ${o.paymentRef}` : ""}</p>}
        </div>
      </div>

      {/* items */}
      <table className="mt-5 w-full border-collapse">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide" style={{ background: modern ? `${v.accent}14` : undefined, color: v.accent }}>
            <th className="border-b-2 px-2 py-2" style={{ borderColor: v.accent }}>#</th>
            <th className="border-b-2 px-2 py-2" style={{ borderColor: v.accent }}>Item</th>
            <th className="border-b-2 px-2 py-2 text-right" style={{ borderColor: v.accent }}>Price</th>
            <th className="border-b-2 px-2 py-2 text-right" style={{ borderColor: v.accent }}>Qty</th>
            <th className="border-b-2 px-2 py-2 text-right" style={{ borderColor: v.accent }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((i, n) => (
            <tr key={i.id + n} className="border-b border-gray-100 align-top">
              <td className="px-2 py-2 text-gray-400">{n + 1}</td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-2">
                  {v.showItemImage && i.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.image} alt="" className="h-9 w-9 rounded object-cover" />
                  )}
                  <div><p className="font-medium">{i.name}</p>{v.showUnit && i.unit && <p className="text-[11px] text-gray-500">{i.unit}</p>}</div>
                </div>
              </td>
              <td className="px-2 py-2 text-right">{taka(i.price)}</td>
              <td className="px-2 py-2 text-right">{i.qty}</td>
              <td className="px-2 py-2 text-right font-semibold">{taka(i.price * i.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* totals */}
      <div className="mt-4 ml-auto w-full max-w-[280px] space-y-1.5">
        {row("Subtotal", taka(o.subtotal))}
        {o.discount > 0 && row(`Discount${o.couponCode ? ` (${o.couponCode})` : ""}`, `−${taka(o.discount)}`, false, "#047857")}
        {row("Delivery", taka(o.delivery))}
        {(o.serviceCharge ?? 0) > 0 && row("Service charge", taka(o.serviceCharge!))}
        {row("Total", taka(o.total), true)}
        {paid ? row("Paid", taka(o.total), false, "#047857") : o.payment === "cod" ? row("To pay on delivery", taka(o.total)) : row("Due", taka(o.total), false, "#b45309")}
      </div>

      {v.showPaidStamp && paid && (
        <div className="pointer-events-none absolute right-10 top-[44%] -rotate-12 rounded-lg border-4 border-emerald-600/60 px-4 py-1 text-2xl font-black tracking-widest text-emerald-600/60">PAID</div>
      )}

      {(v.notes || o.note) && <div className="mt-6 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">{o.note && <p><b>Customer note:</b> {o.note}</p>}{v.notes && <p className="whitespace-pre-line">{v.notes}</p>}</div>}
      {v.terms && <div className="mt-4"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Terms</p><p className="whitespace-pre-line text-[11px] text-gray-500">{v.terms}</p></div>}
      {v.showSignature && !thermal && (
        <div className="mt-10 flex justify-end"><div className="w-48 border-t border-gray-400 pt-1 text-center text-xs text-gray-500">{v.signatureLabel}</div></div>
      )}
      {v.footer && <p className="mt-6 border-t pt-3 text-center text-xs text-gray-500">{v.footer}</p>}
    </div>
  );
}
