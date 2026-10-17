"use client";
import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useList, useToast } from "./ui";
import type { StoreSettings } from "@/lib/types";

/** Loads the store settings once and saves only the keys the page owns (PUT /api/settings is a partial update). */
export function useSettingsForm(keys: (keyof StoreSettings)[]) {
  const toast = useToast();
  const { data, loading, error, reload } = useList<StoreSettings>("/api/settings");
  const [f, setF] = useState<StoreSettings | null>(null);
  const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => { if (data) setF(data); }, [data]);
  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const save = async (okMsg = "Saved — live on the website") => {
    if (!f) return false;
    setBusy(true); setErrs({});
    try {
      const body: Record<string, unknown> = {};
      for (const k of keys) { const v = f[k]; if (v !== undefined) body[k as string] = v; }
      await api("/api/settings", { method: "PUT", body }); toast(okMsg); return true;
    } catch (e: any) { if (e instanceof ApiClientError) setErrs(e.fields); toast(e.message, "err"); return false; } finally { setBusy(false); }
  };
  return { f, set, save, busy, errs, loading, error, reload };
}
