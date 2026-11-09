import { clsx, type ClassValue } from "clsx";

export const cn = (...c: ClassValue[]) => clsx(c);

export function normalizeUrl(input: string): string {
  let s = input.trim();
  if (!s) throw new Error("Enter a website address");
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  const u = new URL(s);
  if (!u.hostname.includes(".")) throw new Error("That doesn't look like a website address");
  return `${u.protocol}//${u.hostname}${u.pathname === "/" ? "" : u.pathname}`.replace(/\/$/, "");
}

export function domainOf(url: string): string {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^www\./, "").toLowerCase();
  }
}

export const today = (d = new Date()) => d.toISOString().slice(0, 10);
export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
export function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return today(d);
}

export const pct = (v: number | null | undefined, digits = 0) =>
  v == null || Number.isNaN(v) ? "—" : `${(v * 100).toFixed(digits)}%`;

export const num = (v: number | null | undefined) => (v == null ? "—" : new Intl.NumberFormat("en-US").format(Math.round(v)));

export const money = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

export function relTime(d: Date | string | null | undefined): string {
  if (!d) return "never";
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const shortDate = (s: string | Date) =>
  new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Run async work over items with bounded concurrency. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Plain-JSON clone so Mongoose docs can cross the server→client boundary. */
export const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v));
