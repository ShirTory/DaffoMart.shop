"use client";
import { useState } from "react";
export default function CopyCode({ code }: { code: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(code).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => {}); }}
      className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-accent bg-accent-soft px-3 py-1.5 font-mono text-sm font-bold text-accent-dark transition hover:bg-accent hover:text-white" title="Click to copy">
      {code}<span className="text-xs font-sans font-medium">{ok ? "Copied ✓" : "Copy"}</span></button>
  );
}
