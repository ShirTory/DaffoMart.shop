"use client";
/** Print / save-as-PDF button shown above an invoice (hidden when printing). */
export default function PrintBar({ back, paper }: { back?: string; paper?: string }) {
  return (
    <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-white/95 px-4 py-2.5 backdrop-blur">
      {back ? <a href={back} className="text-sm font-semibold text-primary hover:underline">← Back</a> : <span />}
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-gray-500 sm:inline">Choose “Save as PDF” in the print dialog to download</span>
        <button type="button" className="btn-primary" onClick={() => window.print()}>🖨 Print / Download PDF</button>
      </div>
      <style>{`@media print{.no-print{display:none!important}body{background:#fff!important}.invoice-doc{box-shadow:none!important;margin:0!important;max-width:none!important}@page{size:${paper === "thermal" ? "80mm auto" : paper === "A5" ? "A5" : "A4"};margin:${paper === "thermal" ? "3mm" : "10mm"}}}`}</style>
    </div>
  );
}
