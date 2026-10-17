"use client";

import { useCallback, useEffect, useState } from "react";
import type { StoreSettings } from "@/lib/types";

const STORAGE_KEY = "daffomart-app-prompt-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true ||
    document.referrer.includes("android-app://")
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isAndroidChrome(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /android/i.test(ua) && /chrome|chromium|edg/i.test(ua) && !/opr\//i.test(ua);
}

export default function InstallAppPrompt({ settings }: { settings: StoreSettings }) {
  const enabled = settings.appPromptEnabled !== false && settings.appPromptEnabled !== undefined
    ? settings.appPromptEnabled
    : false;
  // When undefined on old stores, treat as off until admin enables — but seed sets true for new.
  // User asked for admin on/off; default false if field missing on existing DB.
  const showConfig = settings.appPromptEnabled === true;

  const [visible, setVisible] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  const title = settings.appPromptTitle?.trim() || "Install our App";
  const text =
    settings.appPromptText?.trim() ||
    "Add this store to your home screen for a faster app-like experience.";
  const btnLabel = settings.appPromptBtnLabel?.trim() || "Add to Home Screen";
  const dismissLabel = settings.appPromptDismissLabel?.trim() || "Not now";
  const delayMs = typeof settings.appPromptDelayMs === "number" ? settings.appPromptDelayMs : 2500;
  const hideDays = typeof settings.appPromptHideDays === "number" ? settings.appPromptHideDays : 7;
  const image = settings.appPromptImage?.trim() || settings.logo || "/icon-192.png";

  const wasDismissedRecently = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const at = Number(raw);
      if (!Number.isFinite(at)) return false;
      const days = hideDays <= 0 ? 0 : hideDays;
      if (days === 0) return true; // forever until clear
      return Date.now() - at < days * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }, [hideDays]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setIosHelp(false);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch { /* private mode */ }
  }, []);

  useEffect(() => {
    if (!showConfig || isStandalone() || wasDismissedRecently()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    const t = window.setTimeout(() => {
      if (isStandalone() || wasDismissedRecently()) return;
      setVisible(true);
    }, Math.max(0, delayMs));

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.clearTimeout(t);
    };
  }, [showConfig, delayMs, wasDismissedRecently]);

  const onInstall = async () => {
    if (deferred) {
      setInstalling(true);
      try {
        await deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
        dismiss();
      } catch {
        /* user cancelled */
      } finally {
        setInstalling(false);
      }
      return;
    }
    if (isIos()) {
      setIosHelp(true);
      return;
    }
    // Desktop / other: open instructions
    setIosHelp(true);
  };

  if (!showConfig || !visible) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-prompt-title"
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4">
        {/* Clear close button — top-right, always visible */}
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-bold leading-none text-gray-600 shadow-md transition hover:bg-gray-100 hover:text-gray-900"
          aria-label="Close"
        >
          ×
        </button>
        <div className="relative bg-gradient-to-br from-primary/15 via-white to-accent/10 px-5 pb-4 pt-6">
          <div className="flex items-start gap-4 pr-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt=""
              className="h-16 w-16 shrink-0 rounded-2xl border border-white object-cover shadow-md"
            />
            <div className="min-w-0 pt-0.5">
              <h2 id="app-prompt-title" className="text-lg font-extrabold leading-tight text-gray-900">
                {title}
              </h2>
              <p className="mt-1 text-sm leading-snug text-gray-600">{text}</p>
            </div>
          </div>
        </div>

        {iosHelp ? (
          <div className="space-y-3 border-t px-5 py-4 text-sm text-gray-700">
            {isIos() ? (
              <>
                <p className="font-semibold text-gray-900">On iPhone / iPad (Safari):</p>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>
                    Tap the <span className="inline-flex items-center rounded bg-gray-100 px-1.5 font-semibold">Share</span> button{" "}
                    <span aria-hidden>⎋</span> at the bottom of Safari.
                  </li>
                  <li>
                    Scroll and tap <span className="font-semibold">Add to Home Screen</span>.
                  </li>
                  <li>
                    Tap <span className="font-semibold">Add</span> — the app icon will appear on your home screen.
                  </li>
                </ol>
              </>
            ) : deferred ? (
              <p>Tap the button below to install.</p>
            ) : (
              <>
                <p className="font-semibold text-gray-900">Install from your browser:</p>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>
                    <b>Chrome (Android / Desktop):</b> Menu (⋮) → <b>Install app</b> or <b>Add to Home screen</b>.
                  </li>
                  <li>
                    <b>Safari (Mac):</b> File → Add to Dock (or Share → Add to Home Screen on iOS).
                  </li>
                  <li>
                    <b>Edge:</b> Menu → Apps → Install this site as an app.
                  </li>
                </ul>
              </>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {deferred && (
                <button type="button" className="btn-primary flex-1" disabled={installing} onClick={onInstall}>
                  {installing ? "Installing…" : btnLabel}
                </button>
              )}
              <button type="button" className="btn-outline flex-1" onClick={dismiss}>
                {dismissLabel}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 border-t px-5 py-4 sm:flex-row">
            <button type="button" className="btn-primary flex-1 py-3" disabled={installing} onClick={onInstall}>
              {installing ? "Installing…" : btnLabel}
            </button>
            <button type="button" className="btn-outline flex-1 py-3" onClick={dismiss}>
              {dismissLabel}
            </button>
          </div>
        )}

        <p className="border-t bg-gray-50 px-5 py-2.5 text-center text-[11px] text-gray-400">
          {isIos()
            ? "Works with Safari · Add to Home Screen"
            : isAndroidChrome()
              ? "Works with Chrome · Install / Add to Home screen"
              : "Progressive Web App · Install anytime from browser menu"}
        </p>
      </div>
    </div>
  );
}
