"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Categorical slots in validated order. Brand is always slot 1; competitors follow, never re-ordered. */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];

export interface LineSeries {
  name: string;
  color: string;
  points: { x: string; y: number | null }[];
  emphasis?: boolean;
}

/** Formatters are named presets: functions can't cross the server → client boundary. */
export type Fmt = "pct" | "int" | "num";
const FORMATS: Record<Fmt, (v: number) => string> = {
  pct: (v) => `${Math.round(v)}%`,
  int: (v) => `${Math.round(v)}`,
  num: (v) => new Intl.NumberFormat("en-US", { notation: v >= 10000 ? "compact" : "standard" }).format(Math.round(v)),
};
const ratio = (v: number) => `${Math.round(v * 100)}%`;

const fmtDate = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Multi-series line chart: 2px lines, recessive grid, crosshair + tooltip on hover,
 * direct end-labels for ≤4 series, legend always present for ≥2.
 */
export function LineChart({
  series,
  height = 240,
  yMax,
  format = "int",
  className,
}: {
  series: LineSeries[];
  height?: number;
  yMax?: number;
  format?: Fmt;
  className?: string;
}) {
  const yFormat = FORMATS[format];
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [w, setW] = useState(720);
  const xs = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort(), [series]);
  const max = yMax ?? Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.y ?? 0))) * 1.12;
  const padL = 36;
  const padR = series.length <= 4 ? 96 : 12;
  const padT = 12;
  const padB = 26;
  const iw = Math.max(10, w - padL - padR);
  const ih = height - padT - padB;
  const x = (i: number) => padL + (xs.length <= 1 ? iw / 2 : (i / (xs.length - 1)) * iw);
  const y = (v: number) => padT + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.max(1, Math.ceil(xs.length / 7));

  const measure = (el: HTMLDivElement | null) => {
    (ref as any).current = el;
    if (el && Math.abs(el.clientWidth - w) > 2) setW(el.clientWidth);
  };

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !xs.length) return;
    const px = e.clientX - r.left - padL;
    const i = Math.round((px / iw) * (xs.length - 1));
    setHover(Math.max(0, Math.min(xs.length - 1, i)));
  };

  // Direct labels: nudge apart so they never collide.
  const endLabels = useMemo(() => {
    if (series.length > 4) return [];
    const ls = series
      .map((s) => {
        const last = [...s.points].reverse().find((p) => p.y != null);
        return last ? { name: s.name, color: s.color, y: y(last.y!), v: last.y! } : null;
      })
      .filter(Boolean) as { name: string; color: string; y: number; v: number }[];
    ls.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ls.length; i++) if (ls[i].y - ls[i - 1].y < 14) ls[i].y = ls[i - 1].y + 14;
    return ls;
  }, [series, max, w]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!xs.length) return <div className="grid h-40 place-items-center text-sm text-ink-500">No data yet</div>;

  return (
    <div className={cn("relative", className)}>
      {series.length >= 2 && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5 text-[12px] text-ink-600">
              <span className="h-[3px] w-3.5 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <div ref={measure} className="relative" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} role="img" aria-label="Trend chart">
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={padL + iw} y1={y(t)} y2={y(t)} stroke="#E7E1D4" strokeDasharray={i === 0 ? undefined : "2 4"} />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-400 text-[10.5px] tnum">
                {yFormat(t)}
              </text>
            </g>
          ))}
          {xs.map((d, i) =>
            (i % labelEvery === 0 && xs.length - 1 - i >= labelEvery * 0.6) || i === xs.length - 1 ? (
              <text key={d} x={x(i)} y={height - 6} textAnchor="middle" className="fill-ink-400 text-[10.5px]">
                {fmtDate(d)}
              </text>
            ) : null,
          )}
          {series.map((s) => {
            const pts = xs.map((d) => s.points.find((p) => p.x === d)?.y ?? null);
            const segs: string[] = [];
            let cur = "";
            pts.forEach((v, i) => {
              if (v == null) {
                if (cur) segs.push(cur);
                cur = "";
              } else cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
            });
            if (cur) segs.push(cur);
            return (
              <g key={s.name}>
                {s.emphasis && segs.map((d, i) => <path key={`a${i}`} d={`${d}L${x(xs.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={s.color} opacity={0.06} />)}
                {segs.map((d, i) => (
                  <path key={i} d={d} fill="none" stroke={s.color} strokeWidth={s.emphasis ? 2.5 : 1.75} strokeLinejoin="round" strokeLinecap="round" opacity={s.emphasis || !series.some((x) => x.emphasis) ? 1 : 0.55} />
                ))}
                {xs.length <= 2 &&
                  pts.map((v, i) => (v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />))}
              </g>
            );
          })}
          {endLabels.map((l) => (
            <text key={l.name} x={padL + iw + 8} y={l.y + 4} className="fill-ink-700 text-[11px] font-medium">
              <tspan className="tnum">{yFormat(l.v)}</tspan>
              <tspan className="fill-ink-500" dx={5}>{l.name.length > 12 ? `${l.name.slice(0, 11)}…` : l.name}</tspan>
            </text>
          ))}
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="#46423B" strokeWidth={1} />
              {series.map((s) => {
                const v = s.points.find((p) => p.x === xs[hover])?.y;
                return v == null ? null : <circle key={s.name} cx={x(hover)} cy={y(v)} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />;
              })}
            </g>
          )}
        </svg>
        {hover != null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[160px] rounded-[5px] border border-ink-950 bg-white px-3 py-2.5 shadow-lift"
            style={{ left: Math.min(Math.max(8, x(hover) + 12), w - 180) }}
          >
            <div className="mb-1.5 text-[11px] font-semibold text-ink-500">{fmtDate(xs[hover])}</div>
            {series
              .map((s) => ({ s, v: s.points.find((p) => p.x === xs[hover])?.y }))
              .sort((a, b) => (b.v ?? -1) - (a.v ?? -1))
              .map(({ s, v }) => (
                <div key={s.name} className="flex items-center justify-between gap-4 py-0.5 text-[12px]">
                  <span className="inline-flex items-center gap-1.5 text-ink-700">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <span className="tnum font-semibold text-ink-950">{v == null ? "—" : yFormat(v)}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Ranked horizontal bars (share of voice etc). Value text stays in ink; colour only identifies. */
export function BarList({
  rows,
  format = "ratio",
  max,
}: {
  rows: { name: string; value: number; color: string; highlight?: boolean; sub?: string }[];
  /** "ratio" renders 0..1 values as percentages. */
  format?: Fmt | "ratio";
  max?: number;
}) {
  const fmt = format === "ratio" ? ratio : FORMATS[format];
  const [hover, setHover] = useState<string | null>(null);
  const m = max ?? Math.max(0.0001, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.name} className="group" onMouseEnter={() => setHover(r.name)} onMouseLeave={() => setHover(null)}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className={cn("truncate", r.highlight ? "font-semibold text-ink-950" : "text-ink-700")}>
              {r.name}
              {r.highlight && <span className="ml-1.5 text-[11px] font-medium text-ink-400">you</span>}
            </span>
            <span className="tnum shrink-0 font-semibold text-ink-900">{fmt(r.value)}</span>
          </div>
          <div className="relative h-2 rounded-full bg-ink-100">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / m) * 100)}%`, background: r.color, opacity: hover && hover !== r.name ? 0.45 : 1 }}
            />
          </div>
          {hover === r.name && r.sub && <div className="mt-1 text-[11.5px] text-ink-500">{r.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ values, color = "#2a78d6", width = 96, height = 28 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return <span className="inline-block" style={{ width, height }} />;
  const max = Math.max(...values, 0.0001);
  const min = Math.min(...values, 0);
  const d = values
    .map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 3 - ((v - min) / (max - min || 1)) * (height - 6)).toFixed(1)}`)
    .join("");
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ───────── Question × engine matrix ───────── */
export interface MatrixCell {
  state: "top" | "named" | "low" | "absent" | "none";
  position?: number | null;
  detail?: string;
}
// Sequential blue (one hue, darker = better position). Absent is neutral; no-answer is hatched.
const CELL: Record<MatrixCell["state"], { bg: string; label: string }> = {
  top: { bg: "#184f95", label: "Named first" },
  named: { bg: "#3987e5", label: "Named, top 3" },
  low: { bg: "#9ec5f4", label: "Named, lower down" },
  absent: { bg: "#E7E1D4", label: "Not named" },
  none: { bg: "transparent", label: "No answer / error" },
};

export function Matrix({ rows, cols }: { rows: { id: string; label: string; href?: string; cells: MatrixCell[] }[]; cols: { id: string; label: string }[] }) {
  const [tip, setTip] = useState<{ r: number; c: number } | null>(null);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {(Object.keys(CELL) as MatrixCell["state"][]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-[12px] text-ink-600">
            <span
              className={cn("h-3 w-3 rounded-[3px]", k === "none" && "border border-ink-200")}
              style={{ background: k === "none" ? "repeating-linear-gradient(45deg,#DDD6C7 0 2px,transparent 2px 5px)" : CELL[k].bg }}
            />
            {CELL[k].label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: "2px" }}>
          <thead>
            <tr>
              <th className="sticky left-0 bg-white" />
              {cols.map((c) => (
                <th key={c.id} className="px-1 pb-1 text-center text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.id}>
                <td className="sticky left-0 max-w-[340px] truncate bg-white py-0.5 pr-3 text-[12.5px] text-ink-700">
                  {r.href ? (
                    <a href={r.href} className="hover:text-ink-950 hover:underline">
                      {r.label}
                    </a>
                  ) : (
                    r.label
                  )}
                </td>
                {r.cells.map((cell, ci) => (
                  <td key={ci} className="relative p-0" onMouseEnter={() => setTip({ r: ri, c: ci })} onMouseLeave={() => setTip(null)}>
                    <div
                      className={cn("tnum grid h-7 min-w-[44px] place-items-center rounded-[4px] text-[11px] font-semibold", cell.state === "none" && "border border-ink-150")}
                      style={{
                        background: cell.state === "none" ? "repeating-linear-gradient(45deg,#E7E1D4 0 2px,transparent 2px 6px)" : CELL[cell.state].bg,
                        color: cell.state === "top" || cell.state === "named" ? "#fff" : "#353A43",
                      }}
                    >
                      {cell.position ? `#${cell.position}` : cell.state === "absent" ? "–" : ""}
                    </div>
                    {tip?.r === ri && tip?.c === ci && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-56 -translate-x-1/2 rounded-[5px] border border-ink-950 bg-white px-3 py-2 text-[11.5px] shadow-lift">
                        <div className="font-semibold text-ink-900">{cols[ci].label}</div>
                        <div className="text-ink-600">{CELL[cell.state].label}{cell.position ? ` · position #${cell.position}` : ""}</div>
                        {cell.detail && <div className="mt-1 line-clamp-3 text-ink-500">{cell.detail}</div>}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
