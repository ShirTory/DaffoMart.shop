"use client";
import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { ErrorBox, Field, PageHeader, PageLoader, Spinner, Toggle, useList, useToast } from "@/components/admin/ui";
import { fmtDateTime, statusLabel } from "@/lib/format";
import { ORDER_STATUSES } from "@/lib/types";
import type { CallingConfig, MessageLog, WaTemplateKind, WhatsAppConfig } from "@/lib/types";

type Data = { whatsapp: WhatsAppConfig; env: { accessToken: boolean; appSecret: boolean; verifyToken: boolean; missing: string[] }; tokens: string[]; webhookUrl: string; calling: CallingConfig; callingStatus: { label: string; message: string; active: boolean }; providers: { id: string; label: string; implemented: boolean; envVars: string[] }[]; logs: MessageLog[] };
const KINDS: [WaTemplateKind, string, string][] = [["orderPlaced", "Order confirmation to the customer", "notifyCustomerOnOrder"], ["adminNewOrder", "New-order alert to you", "notifyAdminOnOrder"], ["statusUpdate", "Status update to the customer", "notifyCustomerOnStatus"]];
const LOG_STYLE: Record<string, string> = { accepted: "bg-blue-100 text-blue-800", sent: "bg-blue-100 text-blue-800", delivered: "bg-emerald-100 text-emerald-800", read: "bg-emerald-200 text-emerald-900", failed: "bg-red-100 text-red-700", skipped: "bg-gray-200 text-gray-700", queued: "bg-amber-100 text-amber-800" };
const LOG_NOTE: Record<string, string> = { accepted: "API accepted — delivery not yet confirmed", queued: "No answer recorded yet", skipped: "Not sent", failed: "Not delivered" };

export default function IntegrationsPage() {
  const toast = useToast(); const { data, loading, error, reload } = useList<Data>("/api/admin/integrations");
  const [wa, setWa] = useState<WhatsAppConfig | null>(null); const [call, setCall] = useState<CallingConfig | null>(null); const [busy, setBusy] = useState(""); const [errs, setErrs] = useState<Record<string, string>>({});
  const [testTo, setTestTo] = useState(""); const [testRes, setTestRes] = useState<{ ok: boolean; status: string; message: string } | null>(null);
  useEffect(() => { if (data) { setWa(data.whatsapp); setCall(data.calling); } }, [data]);
  const save = async (kind: "whatsapp" | "calling") => {
    setBusy(kind); setErrs({});
    try { await api("/api/admin/integrations", { method: "PUT", body: kind === "whatsapp" ? { whatsapp: wa } : { calling: call } }); toast("Saved"); reload(); }
    catch (e: any) { if (e instanceof ApiClientError) setErrs(e.fields); toast(e.message, "err"); } finally { setBusy(""); }
  };
  const test = async () => { setBusy("test"); setTestRes(null); try { setTestRes(await api("/api/admin/integrations/test", { method: "POST", body: { to: testTo } })); reload(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(""); } };
  const retry = async (id: string) => { try { await api(`/api/admin/integrations/logs/${id}/retry`, { method: "POST" }); reload(); } catch (e: any) { toast(e.message, "err"); } };
  if (loading) return <PageLoader />; if (error || !data || !wa || !call) return <ErrorBox msg={error || "Could not load"} retry={reload} />;
  const setW = <K extends keyof WhatsAppConfig>(k: K, v: WhatsAppConfig[K]) => setWa({ ...wa, [k]: v });
  const Env = ({ ok, name }: { ok: boolean; name: string }) => <li className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} /><code className="text-xs">{name}</code><span className="text-xs text-gray-500">{ok ? "set" : "NOT set"}</span></li>;
  return (
    <>
      <PageHeader title="WhatsApp & Calling" subtitle="Automatic order messages through the official WhatsApp Business Platform (Meta Cloud API). Only the Owner can change these settings." />
      <section className="card mb-6 space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">WhatsApp order messages</h2><Toggle checked={wa.enabled} onChange={(v) => setW("enabled", v)} label={wa.enabled ? "Automatic messages ON" : "Automatic messages OFF"} /></div>
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Credentials live on the server, never in this form.</p>
          <ul className="mt-2 space-y-1"><Env ok={data.env.accessToken} name="WHATSAPP_ACCESS_TOKEN" /><Env ok={data.env.appSecret} name="WHATSAPP_APP_SECRET (verifies delivery reports)" /><Env ok={data.env.verifyToken} name="WHATSAPP_VERIFY_TOKEN (webhook setup)" /></ul>
          <p className="mt-2 text-xs">Webhook URL for Meta → WhatsApp → Configuration: <code className="break-all">{data.webhookUrl}</code> (subscribe to “messages”). Until the access token is set, nothing is sent and every attempt is logged as <b>skipped</b>.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone Number ID" error={errs.phoneNumberId} hint="Meta → WhatsApp → API setup (digits)"><input className="input font-mono" value={wa.phoneNumberId} onChange={(e) => setW("phoneNumberId", e.target.value.trim())} /></Field>
          <Field label="Business Account ID (optional)" error={errs.businessAccountId}><input className="input font-mono" value={wa.businessAccountId ?? ""} onChange={(e) => setW("businessAccountId", e.target.value.trim())} /></Field>
          <Field label="API version" error={errs.apiVersion}><input className="input" value={wa.apiVersion} onChange={(e) => setW("apiVersion", e.target.value.trim())} /></Field>
          <Field label="Default country code" error={errs.defaultCountryCode} hint="880 for Bangladesh"><input className="input" value={wa.defaultCountryCode} onChange={(e) => setW("defaultCountryCode", e.target.value.trim())} /></Field>
          <Field label="Your WhatsApp number (receives new-order alerts)" error={errs.adminNotifyNumber}><input className="input" inputMode="tel" value={wa.adminNotifyNumber} onChange={(e) => setW("adminNotifyNumber", e.target.value)} placeholder="01XXXXXXXXX" /></Field>
          <Field label="Message type" error={errs.messageMode} hint="Template = works any time (needs templates approved by Meta). Text = only delivered if the customer wrote to you in the last 24 h."><select className="input" value={wa.messageMode} onChange={(e) => setW("messageMode", e.target.value as any)}><option value="template">Approved template (recommended)</option><option value="text">Free text</option></select></Field>
        </div>
        <div className="space-y-4">{KINDS.map(([k, label, flag]) => (
          <div key={k} className="rounded-xl border p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{label}</h3><Toggle checked={Boolean((wa as any)[flag])} onChange={(v) => setW(flag as any, v as any)} label="Send" /></div>
            {wa.messageMode === "template" ? <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Template name" error={errs[`templates.${k}.name`]}><input className="input font-mono text-xs" value={wa.templates[k].name} placeholder="order_confirmation" onChange={(e) => setW("templates", { ...wa.templates, [k]: { ...wa.templates[k], name: e.target.value.trim() } })} /></Field>
              <Field label="Language" error={errs[`templates.${k}.language`]}><input className="input" value={wa.templates[k].language} onChange={(e) => setW("templates", { ...wa.templates, [k]: { ...wa.templates[k], language: e.target.value.trim() } })} /></Field>
              <Field label="Variables {{1}}, {{2}}… in order" error={errs[`templates.${k}.params`]} hint={data.tokens.join(", ")}><input className="input text-xs" value={wa.templates[k].params.join(", ")} onChange={(e) => setW("templates", { ...wa.templates, [k]: { ...wa.templates[k], params: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })} /></Field></div>
              : <Field label="Message text" hint={"Use {{orderNo}}, {{customerName}}, {{total}}, {{items}}, {{trackUrl}}, {{status}}…"}><textarea className="input" rows={3} value={wa.textTemplates[k]} onChange={(e) => setW("textTemplates", { ...wa.textTemplates, [k]: e.target.value })} /></Field>}
          </div>))}
        </div>
        {wa.notifyCustomerOnStatus && <div><p className="label">Send a status update when an order becomes</p><div className="flex flex-wrap gap-2">{ORDER_STATUSES.map((s) => { const on = wa.statusesToNotify.includes(s); return <button key={s} type="button" className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? "border-primary bg-primary-soft text-primary" : "text-gray-500"}`} onClick={() => setW("statusesToNotify", on ? wa.statusesToNotify.filter((x) => x !== s) : [...wa.statusesToNotify, s])}>{statusLabel(s)}</button>; })}</div></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><div className="flex flex-wrap items-center gap-2"><input className="input w-48" placeholder="Test number 01XXXXXXXXX" value={testTo} onChange={(e) => setTestTo(e.target.value)} /><button className="btn-outline" disabled={busy === "test" || !testTo} onClick={test}>{busy === "test" && <Spinner className="h-4 w-4" />}Send real test</button></div><button className="btn-primary" onClick={() => save("whatsapp")} disabled={busy === "whatsapp"}>{busy === "whatsapp" && <Spinner className="h-4 w-4" />}Save WhatsApp settings</button></div>
        {testRes && <p className={`rounded-lg p-3 text-sm ${testRes.ok ? "bg-blue-50 text-blue-900" : "bg-red-50 text-red-800"}`}><b>{testRes.status.toUpperCase()}:</b> {testRes.message}</p>}
      </section>

      <section className="card mb-6 p-5"><h2 className="mb-3 text-lg font-bold">Message log</h2>
        <p className="mb-3 text-xs text-gray-500"><b>Accepted</b> only means WhatsApp took the message. <b>Delivered / read</b> appear after Meta’s webhook confirms them (needs the app secret + webhook URL above).</p>
        {!data.logs.length ? <p className="text-sm text-gray-400">No messages yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px]"><thead className="border-b bg-gray-50"><tr><th className="th">When</th><th className="th">Order</th><th className="th">Type</th><th className="th">To</th><th className="th">Result</th><th className="th" /></tr></thead><tbody className="divide-y">{data.logs.map((l) => (
          <tr key={l.id}><td className="td text-xs text-gray-500">{fmtDateTime(l.createdAt)}</td><td className="td font-mono text-xs">{l.orderNo ?? "—"}</td><td className="td text-xs">{l.kind}</td><td className="td font-mono text-xs">{l.to}</td>
            <td className="td"><span className={`badge ${LOG_STYLE[l.status]}`}>{l.status}</span><p className="mt-0.5 max-w-[260px] text-[11px] text-gray-500">{l.error || l.reason || LOG_NOTE[l.status] || ""}</p></td>
            <td className="td text-right">{["failed", "skipped", "queued"].includes(l.status) && l.orderId && <button className="btn-ghost btn-sm" onClick={() => retry(l.id)}>Retry</button>}</td></tr>))}</tbody></table></div>}
      </section>

      <section className="card space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Calling</h2><Toggle checked={call.enabled} onChange={(v) => setCall({ ...call, enabled: v })} label={call.enabled ? "Enabled" : "Disabled"} /></div>
        <p className={`rounded-xl p-3 text-sm ${data.callingStatus.active ? "bg-emerald-50 text-emerald-900" : "bg-gray-50 text-gray-700"}`}><b>Status:</b> {data.callingStatus.message}</p>
        <p className="text-xs text-gray-500">Tap-to-call buttons on the store already use the phone number in Settings &amp; Contact. A calling provider (click-to-call, call logs) is a prepared placeholder: choosing one below does nothing until it is implemented and its credentials are added.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider" error={errs.provider}><select className="input" value={call.provider} onChange={(e) => setCall({ ...call, provider: e.target.value as any })}>{data.providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
          <Field label="Caller ID / business number" error={errs.callerId}><input className="input" value={call.callerId} onChange={(e) => setCall({ ...call, callerId: e.target.value })} /></Field>
          <Field label="Support number to display" error={errs.displayNumber}><input className="input" value={call.displayNumber} onChange={(e) => setCall({ ...call, displayNumber: e.target.value })} /></Field>
          <Field label="Call hours"><input className="input" value={call.hours} placeholder="9 AM – 9 PM" onChange={(e) => setCall({ ...call, hours: e.target.value })} /></Field>
          <Field label="Internal note" className="sm:col-span-2"><input className="input" value={call.note} onChange={(e) => setCall({ ...call, note: e.target.value })} /></Field></div>
        <div className="flex justify-end"><button className="btn-primary" onClick={() => save("calling")} disabled={busy === "calling"}>{busy === "calling" && <Spinner className="h-4 w-4" />}Save calling settings</button></div>
      </section>
    </>
  );
}
