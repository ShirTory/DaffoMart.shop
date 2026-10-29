"use client";
import { useState } from "react";
import { taka } from "@/lib/format";

export default function SalesChart({ data }: { data: { date: string; orders: number; sales: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 800, H = 260, L = 48, B = 28, T = 12, R = 8;
  const max = Math.max(1, ...data.map((d) => d.sales));
  const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); return Math.ceil(max / p) * p; })();
  const bw = (W - L - R) / data.length;
  const y = (v: number) => T + (H - T - B) * (1 - v / nice);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * nice);
  const label = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Sales chart">
        {ticks.map((t) => (<g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeDasharray={t === 0 ? "" : "3 4"} />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#9ca3af">{t >= 1000 ? `${Math.round(t / 100) / 10}k` : Math.round(t)}</text></g>))}
        {data.map((d, i) => {
          const x = L + i * bw + bw * 0.18, w = bw * 0.64, top = y(d.sales);
          return (<g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
            <rect x={L + i * bw} y={T} width={bw} height={H - T - B} fill="transparent" />
            <rect x={x} y={d.sales ? top : H - B - 2} width={w} height={d.sales ? H - B - top : 2} rx={Math.min(5, w / 2)} fill={hover === i ? "#F7941D" : "#1E3A8A"} opacity={hover === null || hover === i ? 1 : 0.55} />
            {(data.length <= 14 || i % Math.ceil(data.length / 10) === 0) && <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#6b7280">{label(d.date)}</text>}
          </g>);
        })}
      </svg>
      {h && <div className="pointer-events-none absolute right-2 top-0 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-pop"><p className="font-semibold">{label(h.date)}</p><p>{taka(h.sales)} · {h.orders} order{h.orders === 1 ? "" : "s"}</p></div>}
    </div>
  );
}
