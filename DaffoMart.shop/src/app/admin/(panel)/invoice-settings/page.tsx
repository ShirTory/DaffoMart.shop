"use client";
import { ErrorBox, Field, ImageUpload, PageHeader, PageLoader, Spinner, Toggle } from "@/components/admin/ui";
import { useSettingsForm } from "@/components/admin/useSettingsForm";
import InvoiceDoc from "@/components/invoice/InvoiceDoc";
import { BRAND, validHex } from "@/lib/theme";
import type { InvoiceSettings, Order } from "@/lib/types";

const SAMPLE: Order = {
  id: "sample", orderNo: "DM-SAMPLE1", name: "Rahim Uddin", phone: "01712345678", address: "House 12, Road 5, Dhanmondi, Dhaka", zone: "inside", zoneName: "Inside Dhaka",
  payment: "bkash", paymentStatus: "paid", paymentRef: "9A7B6C5D4E", note: "Please call before arriving.",
  items: [{ id: "1", name: "Fresh Tomato", unit: "1 kg", price: 80, qty: 2 }, { id: "2", name: "Napa Extra 500mg", unit: "10 tablets", price: 45, qty: 1 }, { id: "3", name: "Basmati Rice", unit: "5 kg", price: 650, qty: 1 }],
  subtotal: 855, delivery: 60, serviceCharge: 0, discount: 50, couponCode: "WELCOME50", total: 865, status: "confirmed", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

export default function InvoiceSettingsPage() {
  const { f, set, save, busy, errs, loading, error, reload } = useSettingsForm(["invoice", "invoiceFooter"]);
  if (loading) return <PageLoader />; if (error || !f) return <ErrorBox msg={error || "Failed to load"} retry={reload} />;
  const inv: InvoiceSettings = f.invoice ?? {};
  const up = <K extends keyof InvoiceSettings>(k: K, v: InvoiceSettings[K]) => set("invoice", { ...inv, [k]: v });
  const on = (k: keyof InvoiceSettings, def = true) => (inv[k] === undefined ? def : Boolean(inv[k]));
  const T = (k: keyof InvoiceSettings, label: string, ph = "", hint?: string) => (
    <Field label={label} hint={hint} error={errs[k as string]}><input className="input" value={(inv[k] as string) ?? ""} placeholder={ph} onChange={(e) => up(k, e.target.value as never)} /></Field>
  );
  return (
    <>
      <PageHeader title="Invoice" subtitle="Every order gets an invoice. Design it here — customers open it from Track order, you print it from Orders.">
        <button className="btn-primary" onClick={() => save()} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save changes</button>
      </PageHeader>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,460px)_1fr]">
        <div className="space-y-5">
          <section className="card space-y-4 p-5">
            <h2 className="font-bold">Business details on the invoice</h2>
            {T("companyName", "Business name", f.storeName)}
            <ImageUpload kind="general" label="Invoice logo" aspect="aspect-[3/1]" rounded="rounded-lg" value={inv.logo} onChange={(v) => up("logo", v)} hint="Empty = the website logo" />
            <Toggle checked={on("showLogo")} onChange={(v) => up("showLogo", v)} label="Show logo" />
            {T("address", "Address", f.address)}
            <div className="grid gap-4 sm:grid-cols-2">{T("phone", "Phone", f.phone)}{T("email", "Email", f.email)}{T("website", "Website", "www.example.com")}</div>
            <div className="grid gap-4 sm:grid-cols-2">{T("taxLabel", "Tax number label", "BIN / TIN")}{T("taxId", "Tax number", "", "Leave empty to hide")}</div>
          </section>
          <section className="card space-y-4 p-5">
            <h2 className="font-bold">Look</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {T("title", "Document title", "INVOICE")}{T("prefix", "Invoice number prefix", "INV-", "INV-ABC1234 comes from order DM-ABC1234")}
              <Field label="Paper"><select className="input" value={inv.paper || "A4"} onChange={(e) => up("paper", e.target.value as never)}><option value="A4">A4</option><option value="A5">A5 (half page)</option><option value="thermal">Receipt (80 mm thermal)</option></select></Field>
              <Field label="Layout"><select className="input" value={inv.layout || "classic"} onChange={(e) => up("layout", e.target.value as never)}><option value="classic">Classic</option><option value="modern">Modern (coloured header)</option></select></Field>
              <Field label="Accent colour" error={errs.accent}>
                <div className="flex items-center gap-2"><input type="color" className="h-10 w-12 cursor-pointer rounded border bg-white p-1" value={validHex(inv.accent) || validHex(f.primaryColor) || BRAND.primary} onChange={(e) => up("accent", e.target.value)} /><input className="input font-mono" maxLength={7} value={inv.accent ?? ""} placeholder="Brand colour" onChange={(e) => up("accent", e.target.value)} /></div>
              </Field>
            </div>
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Toggle checked={on("showItemImage", false)} onChange={(v) => up("showItemImage", v)} label="Product pictures" />
              <Toggle checked={on("showUnit")} onChange={(v) => up("showUnit", v)} label="Pack size / unit" />
              <Toggle checked={on("showCustomerPhone")} onChange={(v) => up("showCustomerPhone", v)} label="Customer phone" />
              <Toggle checked={on("showPaymentInfo")} onChange={(v) => up("showPaymentInfo", v)} label="Payment method & status" />
              <Toggle checked={on("showCourier")} onChange={(v) => up("showCourier", v)} label="Courier & tracking no." />
              <Toggle checked={on("showPaidStamp")} onChange={(v) => up("showPaidStamp", v)} label="“PAID” stamp" />
              <Toggle checked={on("showSignature", false)} onChange={(v) => up("showSignature", v)} label="Signature line" />
            </div>
            {inv.showSignature && T("signatureLabel", "Signature label", "Authorised signature")}
          </section>
          <section className="card space-y-4 p-5">
            <h2 className="font-bold">Messages</h2>
            <Field label="Note"><textarea className="input min-h-[64px]" maxLength={400} value={inv.notes ?? ""} onChange={(e) => up("notes", e.target.value)} /></Field>
            <Field label="Terms & return note" hint="e.g. returns accepted within 24 hours"><textarea className="input min-h-[72px]" maxLength={800} value={inv.terms ?? ""} onChange={(e) => up("terms", e.target.value)} /></Field>
            <Field label="Footer line"><input className="input" maxLength={300} value={inv.footer ?? f.invoiceFooter ?? ""} placeholder="Thank you for shopping with us!" onChange={(e) => up("footer", e.target.value)} /></Field>
          </section>
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Live preview (sample order)</p>
          <div className="scroll-thin overflow-auto rounded-xl border bg-gray-100 p-3"><div className="origin-top shadow-lg"><InvoiceDoc order={SAMPLE} settings={f} /></div></div>
        </div>
      </div>
    </>
  );
}
