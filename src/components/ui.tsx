import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ENGINE_META, type EngineId } from "@/lib/engines/types";
import { BRAND_MARKS } from "@/lib/engines/logos";
import { cn } from "@/lib/utils";

/* ───────── Brand ───────── */
/** Wordmark: serif "Ment" + highlighted "iq" — the product's own move, applied to its name. */
export function Logo({ className, dark = false, size = "md" }: { className?: string; dark?: boolean; size?: "sm" | "md" | "lg" }) {
  const px = { sm: 20, md: 25, lg: 34 }[size];
  return (
    <span className={cn("inline-flex select-none items-baseline", className)} aria-label="SeoWaveTech">
      <span className={cn("display leading-none", dark ? "text-white" : "text-ink-950")} style={{ fontSize: px, letterSpacing: "-0.035em" }}>
        SeoWave<span className="hl-under" style={{ padding: "0 0.04em" }}>Tech</span>
      </span>
    </span>
  );
}

/* ───────── Buttons ───────── */
type Variant = "primary" | "lime" | "outline" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";
const variants: Record<Variant, string> = {
  primary: "bg-ink-950 text-white hover:bg-ink-800 border border-ink-950",
  lime: "bg-lime text-ink-950 border border-ink-950 shadow-hard hover:-translate-x-px hover:-translate-y-px hover:shadow-lift active:translate-x-0 active:translate-y-0 active:shadow-none",
  outline: "bg-white text-ink-950 border border-ink-900/80 hover:bg-ink-950 hover:text-white",
  ghost: "text-ink-700 hover:bg-ink-150/70 hover:text-ink-950",
  subtle: "bg-ink-150 text-ink-900 hover:bg-ink-200",
  danger: "bg-white text-bad border border-bad/40 hover:bg-bad hover:text-white",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded gap-1.5",
  md: "h-10 px-4 text-[14px] rounded-[5px] gap-2",
  lg: "h-12 px-6 text-[15px] rounded-[5px] gap-2",
};
const btnBase = "inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none";

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={cn(btnBase, variants[variant], sizes[size], className)} {...p} />;
}
export function ButtonLink({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={cn(btnBase, variants[variant], sizes[size], className)} {...p} />;
}

/* ───────── Surfaces ───────── */
export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-ink-300/80 bg-white", className)} {...p} />;
}
export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h3 className="serif text-[19px] leading-tight tracking-[-0.01em] text-ink-950">{title}</h3>
        {subtitle && <p className="mt-1 text-[13px] text-ink-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Page masthead: dateline kicker, serif headline, double rule underneath. */
export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="rule-double mb-7 flex flex-wrap items-end justify-between gap-4 pb-5">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2.5">{eyebrow}</div>}
        <h1 className="display text-[38px] text-ink-950 sm:text-[46px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ───────── Badges ───────── */
type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "lime" | "dark";
const tones: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-300/70",
  good: "bg-good-soft text-good ring-good/25",
  warn: "bg-warn-soft text-warn ring-warn/25",
  bad: "bg-bad-soft text-bad ring-bad/25",
  info: "bg-[#E4ECF6] text-[#1C4F8F] ring-[#1C4F8F]/20",
  lime: "bg-lime text-ink-950 ring-ink-950/60",
  dark: "bg-ink-950 text-white ring-ink-950",
};
export function Badge({ tone = "neutral", className, children, dot }: { tone?: Tone; className?: string; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] px-1.5 py-[3px] font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.06em] ring-1 ring-inset", tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Status always carries an icon + label, never colour alone. */
export function StatusIcon({ status }: { status: "pass" | "warn" | "fail" }) {
  const base = "grid h-5 w-5 shrink-0 place-items-center rounded-[3px] ring-1 ring-inset";
  if (status === "pass")
    return (
      <span className={cn(base, "bg-good-soft text-good ring-good/25")} aria-label="Pass">
        <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    );
  if (status === "warn")
    return (
      <span className={cn(base, "bg-warn-soft text-warn ring-warn/25")} aria-label="Needs work">
        <svg width="11" height="11" viewBox="0 0 12 12"><path d="M6 3v3.6M6 8.8v.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </span>
    );
  return (
    <span className={cn(base, "bg-bad-soft text-bad ring-bad/25")} aria-label="Fail">
      <svg width="10" height="10" viewBox="0 0 12 12"><path d="m3 3 6 6M9 3 3 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
    </span>
  );
}

/** Which official mark each engine uses. Google's three surfaces share the Google mark; the label tells them apart. */
const ENGINE_MARK: Record<string, string> = { claude: "claude", gemini: "gemini", perplexity: "perplexity", google: "google", google_aio: "google", ai_mode: "google" };

export function EngineChip({ id, withLabel = true, className }: { id: string; withLabel?: boolean; className?: string }) {
  const m = ENGINE_META[id as EngineId] ?? { label: id, short: id.slice(0, 2), tint: "#6A707A" };
  const mark = BRAND_MARKS[ENGINE_MARK[id] ?? ""];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] text-ink-800", className)} title={m.label}>
      {mark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" role="img" aria-label={mark.title} className="shrink-0">
          <path d={mark.path} fill={mark.hex} />
        </svg>
      ) : (
        // No official mark is freely available for this engine, so we use a plain text badge instead of redrawing it.
        <span className="grid h-[18px] min-w-[18px] place-items-center rounded-[3px] border border-ink-950 bg-white px-1 font-mono text-[9px] font-semibold leading-none text-ink-950">
          {m.short}
        </span>
      )}
      {withLabel && <span className="whitespace-nowrap">{m.label}</span>}
    </span>
  );
}

/* ───────── Numbers ───────── */
/** delta: positive = better. label is the pre-formatted magnitude, e.g. "4 pts" or "0.6". */
export function Stat({ label, value, sub, delta, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; delta?: { value: number; label: string } | null; className?: string }) {
  const show = delta && Number.isFinite(delta.value) && Math.abs(delta.value) > 1e-9;
  return (
    <div className={cn("min-w-0", className)}>
      <div className="eyebrow">{label}</div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="display tnum text-[36px] leading-none text-ink-950">{value}</span>
        {show && (
          <span className={cn("tnum inline-flex items-center gap-0.5 font-mono text-[11.5px] font-medium", delta!.value > 0 ? "text-good" : "text-bad")} title="Change vs 7 days earlier">
            {delta!.value > 0 ? "▲" : "▼"} {delta!.label}
          </span>
        )}
      </div>
      {sub && <div className="mt-2 text-[12.5px] text-ink-500">{sub}</div>}
    </div>
  );
}

/**
 * The visibility score, set like a front-page figure: a big serif number over a
 * 20-tick ruler. One value, so no legend or hover. `size` scales the numeral.
 */
export function ScoreRing({ score, size = 132, label = "AI visibility" }: { score: number; size?: number; label?: string; stroke?: number }) {
  const v = Math.max(0, Math.min(100, Math.round(score)));
  const filled = Math.round(v / 5);
  const band = v >= 70 ? "text-good" : v >= 40 ? "text-warn" : "text-bad";
  return (
    <div className="inline-flex flex-col items-center" style={{ width: Math.max(150, size * 1.15) }}>
      <div className="eyebrow">{label}</div>
      <div className="mt-2 flex items-baseline">
        <span className="display tnum leading-none text-ink-950" style={{ fontSize: size * 0.62 }}>
          {v}
        </span>
        <span className="ml-1 font-mono text-[12px] text-ink-400">/100</span>
      </div>
      <div className="mt-3 flex w-full gap-[3px]" aria-hidden>
        {Array.from({ length: 20 }, (_, i) => (
          <span key={i} className={cn("h-3 flex-1 rounded-[1px]", i < filled ? cn("bg-current", band) : "bg-ink-200")} />
        ))}
      </div>
    </div>
  );
}

export function Meter({ value, className, tone = "ink" }: { value: number; className?: string; tone?: "ink" | "good" | "warn" | "bad" | "blue" }) {
  const c = { ink: "bg-ink-900", good: "bg-good", warn: "bg-warn", bad: "bg-bad", blue: "bg-series-1" }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-[1px] bg-ink-150", className)}>
      <div className={cn("h-full", c)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

/* ───────── Forms ───────── */
export function Label({ className, ...p }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-ink-800", className)} {...p} />;
}
const field =
  "w-full rounded-[5px] border border-ink-300 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-400 transition focus:border-ink-950 focus:outline-none focus:ring-[3px] focus:ring-lime/70 disabled:bg-ink-100 disabled:text-ink-400";
export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={cn(field, "h-10", className)} {...p} />;
}
export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cn(field, "py-2.5 leading-relaxed", className)} {...p} />;
}
export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={cn(field, "h-10 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22><path d=%22M3 4.5 6 7.5 9 4.5%22 fill=%22none%22 stroke=%22%2346423B%22 stroke-width=%221.5%22/></svg>')] bg-[right_12px_center] bg-no-repeat pr-9", className)} {...p} />;
}
export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1.5 text-[12px] text-ink-500">{hint}</p>}
    </div>
  );
}

export function Empty({ title, children, action, icon }: { title: ReactNode; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-[5px] border border-dashed border-ink-400 text-ink-500">
        {icon ?? (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3 3" strokeLinecap="round" /></svg>
        )}
      </div>
      <div className="serif text-[20px] text-ink-950">{title}</div>
      {children && <div className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-500">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Callout with a heavy left rule, like a sidebar note in a newspaper. */
export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "good" | "bad"; children: ReactNode; className?: string }) {
  const t = {
    info: "bg-white text-ink-800 border-ink-950",
    warn: "bg-warn-soft/70 text-[#6E4100] border-warn",
    good: "bg-good-soft/70 text-[#0F4F31] border-good",
    bad: "bg-bad-soft/70 text-[#7A1F19] border-bad",
  }[tone];
  return <div className={cn("rounded-r-[5px] border-y border-r border-y-ink-200 border-r-ink-200 border-l-[3px] px-4 py-3 text-[13.5px] leading-relaxed", t, className)}>{children}</div>;
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-[13.5px]">{children}</table>
    </div>
  );
}
export const Th = ({ className, ...p }: ComponentProps<"th">) => <th className={cn("whitespace-nowrap border-b border-ink-900 px-5 py-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-500", className)} {...p} />;
export const Td = ({ className, ...p }: ComponentProps<"td">) => <td className={cn("border-b border-ink-200 px-5 py-3 align-middle text-ink-800", className)} {...p} />;

/** "Continue with Google" — a plain link so it works without JavaScript. */
export function GoogleButton({ href, label = "Continue with Google" }: { href: string; label?: string }) {
  return (
    <a href={href} className={cn(btnBase, variants.outline, sizes.lg, "w-full")}>
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {label}
    </a>
  );
}

export function OrDivider() {
  return (
    <div className="eyebrow my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-ink-200" />
      or with email
      <span className="h-px flex-1 bg-ink-200" />
    </div>
  );
}
