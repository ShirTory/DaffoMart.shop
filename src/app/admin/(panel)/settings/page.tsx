"use client";
import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { ErrorBox, Field, Icon, ImageUpload, PageHeader, PageLoader, Spinner, StatusBadge, Toggle, useList, useToast } from "@/components/admin/ui";
import type { StoreSettings } from "@/lib/types";

const KEYS = ["storeName", "tagline", "announcement", "address", "phone", "whatsapp", "email", "facebook", "hours", "mapUrl", "minOrder", "serviceCharge"] as const;
type K = (typeof KEYS)[number];
interface Sys {
  storage: string; persistent: boolean; devCredentials: boolean;
  firebase: { configured: boolean; projectId: string; bucket: string };
  test?: { firestore: string; storage: string };
}

// Colours, buttons, support buttons and empty-state look moved to Admin → Appearance; invoice to Admin → Invoice.
type Extra = {
  returnPolicy: string; exchangePolicy: string; courierOutsideNote: string; metaPixelId: string;
  appPromptEnabled: boolean;
  appPromptTitle: string;
  appPromptText: string;
  appPromptImage: string;
  appPromptBtnLabel: string;
  appPromptDismissLabel: string;
  appPromptDelayMs: string;
  appPromptHideDays: string;
};

export default function SettingsPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useList<StoreSettings>("/api/settings");
  const sys = useList<Sys>("/api/admin/system");
  const [f, setF] = useState<Record<K, string> | null>(null);
  const [x, setX] = useState<Extra | null>(null);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [test, setTest] = useState<Sys["test"] | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!data) return;
    setF(Object.fromEntries(KEYS.map((k) => [k, String(data[k] ?? "")])) as Record<K, string>);
    setX({
      returnPolicy: data.returnPolicy || "",
      exchangePolicy: data.exchangePolicy || "",
      courierOutsideNote: data.courierOutsideNote || "",
      metaPixelId: data.metaPixelId || "",
      appPromptEnabled: data.appPromptEnabled === true,
      appPromptTitle: data.appPromptTitle || "",
      appPromptText: data.appPromptText || "",
      appPromptImage: data.appPromptImage || "",
      appPromptBtnLabel: data.appPromptBtnLabel || "",
      appPromptDismissLabel: data.appPromptDismissLabel || "",
      appPromptDelayMs: data.appPromptDelayMs != null ? String(data.appPromptDelayMs) : "2500",
      appPromptHideDays: data.appPromptHideDays != null ? String(data.appPromptHideDays) : "7",
    });
  }, [data]);

  if (loading) return <PageLoader />;
  if (error || !f || !x) return <ErrorBox msg={error || "Failed to load"} retry={reload} />;

  const set = (k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const setXStr = (k: keyof Extra) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setX({ ...x, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrs({});
    try {
      await api("/api/settings", { method: "PUT", body: {
        ...f,
        returnPolicy: x.returnPolicy,
        exchangePolicy: x.exchangePolicy,
        courierOutsideNote: x.courierOutsideNote,
        metaPixelId: x.metaPixelId,
        appPromptEnabled: x.appPromptEnabled,
        appPromptTitle: x.appPromptTitle || undefined,
        appPromptText: x.appPromptText || undefined,
        appPromptImage: x.appPromptImage || undefined,
        appPromptBtnLabel: x.appPromptBtnLabel || undefined,
        appPromptDismissLabel: x.appPromptDismissLabel || undefined,
        appPromptDelayMs: x.appPromptDelayMs === "" ? undefined : Number(x.appPromptDelayMs),
        appPromptHideDays: x.appPromptHideDays === "" ? undefined : Number(x.appPromptHideDays),
      } });
      toast("Settings saved");
      reload();
    } catch (err: any) {
      if (err instanceof ApiClientError) setErrs(err.fields || {});
      toast(err.message, "err");
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    try {
      setTest((await api<Sys>("/api/admin/system?test=1")).test ?? null);
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setTesting(false);
    }
  };
  const fb = sys.data?.firebase;

  return (
    <>
      <form onSubmit={save}>
        <PageHeader title="Settings & contact" subtitle="Store info, contact numbers, delivery notes and the return & exchange policy">
          <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save all</button>
        </PageHeader>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card space-y-4 p-5">
            <h2 className="font-bold">Store information</h2>
            <Field label="Store name" error={errs.storeName}><input className="input" value={f.storeName} onChange={set("storeName")} /></Field>
            <Field label="Tagline" hint="Browser title & footer"><input className="input" value={f.tagline} onChange={set("tagline")} /></Field>
            <Field label="Announcement bar" hint="Top bar — empty to hide"><input className="input" value={f.announcement} onChange={set("announcement")} /></Field>
            <Field label="Minimum order (৳)" error={errs.minOrder}><input className="input" type="number" min="0" value={f.minOrder} onChange={set("minOrder")} /></Field>
            <Field label="Service charge (৳)" hint="Added to every order total. 0 = none" error={errs.serviceCharge}><input className="input" type="number" min="0" value={f.serviceCharge} onChange={set("serviceCharge")} /></Field>
          </section>
          <section className="card space-y-4 p-5">
            <h2 className="font-bold">Contact</h2>
            <Field label="Address"><input className="input" value={f.address} onChange={set("address")} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone"><input className="input" value={f.phone} onChange={set("phone")} placeholder="01XXXXXXXXX" /></Field>
              <Field label="WhatsApp" hint="e.g. 8801XXXXXXXXX"><input className="input" value={f.whatsapp} onChange={set("whatsapp")} /></Field>
            </div>
            <Field label="Email"><input className="input" value={f.email} onChange={set("email")} /></Field>
            <Field label="Opening hours"><input className="input" value={f.hours} onChange={set("hours")} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Facebook URL"><input className="input" value={f.facebook} onChange={set("facebook")} /></Field>
              <Field label="Google Maps link"><input className="input" value={f.mapUrl} onChange={set("mapUrl")} /></Field>
            </div>
          </section>

          <section className="card space-y-2 p-5">
            <h2 className="font-bold">Looking for colours, buttons, call / WhatsApp buttons or empty messages?</h2>
            <p className="text-sm text-gray-500">They now live in <a className="font-semibold text-primary underline" href="/admin/appearance">Appearance</a> (look), <a className="font-semibold text-primary underline" href="/admin/texts">Website Text</a> (wording) and <a className="font-semibold text-primary underline" href="/admin/invoice-settings">Invoice</a>.</p>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-bold">Outside Dhaka (courier) note</h2>
            <Field label="Shown at checkout and in the footer for courier-delivered areas"><textarea className="input min-h-[72px]" value={x.courierOutsideNote} onChange={setXStr("courierOutsideNote")} /></Field>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-bold">Tracking</h2>
            <Field label="Meta Pixel ID" hint="Facebook / Meta Pixel — leave empty to disable. Only digits."><input className="input" value={x.metaPixelId} onChange={setXStr("metaPixelId")} placeholder="e.g. 1234567890" /></Field>
          </section>

          <section className="card space-y-4 p-5 lg:col-span-2">
            <h2 className="font-bold">Return & Exchange policy</h2>
            <p className="text-xs text-gray-500">Shown on <a href="/policy" className="text-primary underline" target="_blank">/policy</a></p>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Return policy"><textarea className="input min-h-[140px]" value={x.returnPolicy} onChange={setXStr("returnPolicy")} /></Field>
              <Field label="Exchange policy"><textarea className="input min-h-[140px]" value={x.exchangePolicy} onChange={setXStr("exchangePolicy")} /></Field>
            </div>
          </section>
        </div>
      </form>


      <section className="card mt-6 space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold">App install popup (Add to Home Screen)</h2>
            <p className="mt-0.5 text-sm text-gray-600">
              Shows a popup asking customers to install the store as an app. Uses Chrome&apos;s native install prompt on Android/desktop and step-by-step instructions on iPhone/iPad (Safari).
            </p>
          </div>
          <Toggle checked={x.appPromptEnabled} onChange={(v) => setX({ ...x, appPromptEnabled: v })} label={x.appPromptEnabled ? "On" : "Off"} />
        </div>
        {x.appPromptEnabled && (
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
            <Field label="Title"><input className="input" value={x.appPromptTitle} onChange={setXStr("appPromptTitle")} placeholder="Install DaffoMart App" /></Field>
            <Field label="Install button label"><input className="input" value={x.appPromptBtnLabel} onChange={setXStr("appPromptBtnLabel")} placeholder="Add to Home Screen" /></Field>
            <Field label="Message" className="sm:col-span-2"><textarea className="input min-h-[80px]" value={x.appPromptText} onChange={setXStr("appPromptText")} placeholder="Add to home screen for faster shopping…" /></Field>
            <Field label="Dismiss button label"><input className="input" value={x.appPromptDismissLabel} onChange={setXStr("appPromptDismissLabel")} placeholder="Not now" /></Field>
            <Field label="Delay before show (ms)" hint="e.g. 2500 = 2.5 seconds"><input className="input" type="number" min={0} max={60000} value={x.appPromptDelayMs} onChange={setXStr("appPromptDelayMs")} /></Field>
            <Field label="Hide for N days after dismiss" hint="0 = hide until they clear site data"><input className="input" type="number" min={0} max={365} value={x.appPromptHideDays} onChange={setXStr("appPromptHideDays")} /></Field>
            <div className="sm:col-span-2">
              <ImageUpload kind="general" label="Popup image / icon (optional)" hint="Defaults to store logo or app icon" value={x.appPromptImage || undefined} onChange={(v) => setX({ ...x, appPromptImage: v || "" })} aspect="aspect-square" rounded="rounded-2xl" />
            </div>
          </div>
        )}
      </section>

      <section className="card mt-6 space-y-3 p-5">
        <h2 className="font-bold">Delivery charges</h2>
        <p className="text-sm text-gray-600">
          Areas and charges: <a href="/admin/delivery" className="font-semibold text-primary underline">Delivery Areas</a>
        </p>
      </section>

      <section className="card mt-6 space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Database &amp; storage (Firebase)</h2>
            <p className="text-xs text-gray-500">Permanent storage for products, orders and images.</p>
          </div>
          <button type="button" className="btn-outline" onClick={runTest} disabled={testing}>
            {testing ? <Spinner className="h-4 w-4" /> : <Icon name="check" className="h-4 w-4" />}Test connection
          </button>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Mode</p>
            <StatusBadge status={sys.data?.persistent ? "active" : "low"} label={sys.data?.persistent ? "Firebase (permanent)" : "Local / temporary"} />
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Project</p>
            <p className="font-medium">{fb?.projectId || "not set"}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Storage bucket</p>
            <p className="truncate font-medium">{fb?.bucket || "not set"}</p>
          </div>
        </div>
        {test && (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {([["Firestore database", test.firestore], ["Storage (images)", test.storage]] as const).map(([l, v]) => (
              <div key={l} className={`rounded-lg p-3 ${v === "OK" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                <p className="text-xs font-semibold uppercase">{l}</p>
                <p className="mt-0.5 break-words">{v === "OK" ? "✓ Working" : v}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
