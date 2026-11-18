import * as cheerio from "cheerio";
import { domainOf, pool } from "../utils";

export const BOT_UA = "Mozilla/5.0 (compatible; BayClusterLabBot/1.0; +https://bayclusterlab.com/bot)";

export interface FetchedPage {
  url: string;
  status: number;
  html: string;
  headers: Record<string, string>;
  ms: number;
}

export async function fetchText(url: string, timeoutMs = 15_000): Promise<FetchedPage | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { "user-agent": BOT_UA, accept: "text/html,*/*" }, redirect: "follow", signal: ctrl.signal });
    const type = res.headers.get("content-type") ?? "";
    const html = type.includes("text") || type.includes("xml") || type.includes("json") || !type ? await res.text() : "";
    return { url: res.url || url, status: res.status, html: html.slice(0, 3_000_000), headers: Object.fromEntries(res.headers), ms: Date.now() - started };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export interface PageFacts {
  url: string;
  status: number;
  ms: number;
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  canonical: string;
  noindex: boolean;
  lang: string;
  wordCount: number;
  rawTextChars: number;
  scriptCount: number;
  jsonLdTypes: string[];
  hasOg: boolean;
  imgCount: number;
  imgMissingAlt: number;
  questionHeadings: number;
  hasDate: boolean;
  hasAuthor: boolean;
  hasTable: boolean;
  hasList: boolean;
  internalLinks: string[];
  text: string;
}

function collectLdTypes(node: any, out: Set<string>) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach((n) => collectLdTypes(n, out));
  const t = node["@type"];
  if (typeof t === "string") out.add(t);
  else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.add(x));
  if (node["@graph"]) collectLdTypes(node["@graph"], out);
  for (const v of Object.values(node)) if (typeof v === "object") collectLdTypes(v, out);
}

export function parsePage(p: FetchedPage): PageFacts {
  const $ = cheerio.load(p.html);
  const base = new URL(p.url);
  const ld = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      collectLdTypes(JSON.parse($(el).text()), ld);
    } catch {
      /* invalid JSON-LD is itself a finding, but we just skip it */
    }
  });
  const scriptCount = $("script").length;
  $("script,style,noscript,svg,template").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const h2 = $("h2").map((_, e) => $(e).text().trim()).get();
  const h3 = $("h3").map((_, e) => $(e).text().trim()).get();
  const links = new Set<string>();
  $("a[href]").each((_, el) => {
    try {
      const u = new URL($(el).attr("href")!, base);
      if (domainOf(u.href) === domainOf(base.href) && /^https?:$/.test(u.protocol)) {
        u.hash = "";
        if (!/\.(pdf|jpg|jpeg|png|gif|svg|webp|zip|mp4|mp3|xml)$/i.test(u.pathname)) links.add(u.href.replace(/\/$/, ""));
      }
    } catch {
      /* ignore bad hrefs */
    }
  });
  const robotsMeta = ($('meta[name="robots"]').attr("content") ?? "").toLowerCase();
  const imgs = $("img");
  return {
    url: p.url,
    status: p.status,
    ms: p.ms,
    title: $("title").first().text().trim(),
    metaDescription: ($('meta[name="description"]').attr("content") ?? "").trim(),
    h1: $("h1").map((_, e) => $(e).text().trim()).get(),
    h2,
    canonical: $('link[rel="canonical"]').attr("href") ?? "",
    noindex: robotsMeta.includes("noindex") || (p.headers["x-robots-tag"] ?? "").includes("noindex"),
    lang: $("html").attr("lang") ?? "",
    wordCount: text ? text.split(" ").length : 0,
    rawTextChars: text.length,
    scriptCount,
    jsonLdTypes: [...ld],
    hasOg: $('meta[property="og:title"]').length > 0,
    imgCount: imgs.length,
    imgMissingAlt: imgs.filter((_, e) => !($(e).attr("alt") ?? "").trim()).length,
    questionHeadings: [...h2, ...h3].filter((h) => /\?$|^(how|what|why|when|which|who|can|does|is|are|should)\b/i.test(h)).length,
    hasDate: $("time[datetime]").length > 0 || /"datePublished"|"dateModified"/.test(p.html),
    hasAuthor: $('[rel="author"], .author, [itemprop="author"]').length > 0 || /"author"\s*:/.test(p.html),
    hasTable: $("table").length > 0,
    hasList: $("ul li, ol li").length >= 3,
    internalLinks: [...links],
    text: text.slice(0, 20_000),
  };
}

/* ───────── robots.txt ───────── */

export const AI_BOTS = [
  { ua: "GPTBot", owner: "OpenAI (training)" },
  { ua: "OAI-SearchBot", owner: "ChatGPT search" },
  { ua: "ChatGPT-User", owner: "ChatGPT browsing" },
  { ua: "ClaudeBot", owner: "Anthropic" },
  { ua: "Claude-SearchBot", owner: "Claude search" },
  { ua: "PerplexityBot", owner: "Perplexity" },
  { ua: "Google-Extended", owner: "Gemini" },
  { ua: "Googlebot", owner: "Google Search & AI Overviews" },
  { ua: "Bingbot", owner: "Bing & Copilot" },
  { ua: "CCBot", owner: "Common Crawl" },
] as const;

/** Is the site root disallowed for a user agent? Group-matching per RFC 9309 (simplified). */
export function robotsBlocks(robots: string, ua: string): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const [, k, v] = m;
    const key = k.toLowerCase();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(v.trim().toLowerCase());
      lastWasAgent = true;
    } else if ((key === "disallow" || key === "allow") && cur) {
      cur.rules.push({ allow: key === "allow", path: v.trim() });
      lastWasAgent = false;
    } else lastWasAgent = false;
  }
  const lower = ua.toLowerCase();
  const group = groups.find((g) => g.agents.includes(lower)) ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return false;
  const rootDisallow = group.rules.some((r) => !r.allow && r.path === "/");
  const rootAllow = group.rules.some((r) => r.allow && r.path === "/");
  return rootDisallow && !rootAllow;
}

/* ───────── Site crawl ───────── */

export interface SiteCrawl {
  origin: string;
  home: PageFacts | null;
  pages: PageFacts[];
  robots: string | null;
  llmsTxt: boolean;
  sitemapUrls: string[];
  https: boolean;
}

async function sitemapUrls(origin: string, robots: string | null, limit: number): Promise<string[]> {
  const declared = (robots ?? "")
    .split(/\r?\n/)
    .map((l) => /^sitemap:\s*(\S+)/i.exec(l.trim())?.[1])
    .filter(Boolean) as string[];
  const queue = declared.length ? declared : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  const urls: string[] = [];
  const seen = new Set<string>();
  while (queue.length && urls.length < limit && seen.size < 8) {
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);
    const r = await fetchText(sm);
    if (!r || r.status >= 400) continue;
    const locs = [...r.html.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
    if (/<sitemapindex/i.test(r.html)) queue.push(...locs);
    else urls.push(...locs);
  }
  return urls.slice(0, limit);
}

export async function crawlSite(url: string, maxPages = 25): Promise<SiteCrawl> {
  const u = new URL(url);
  const origin = `${u.protocol}//${u.host}`;
  const [homeRaw, robotsRaw, llms] = await Promise.all([fetchText(url), fetchText(`${origin}/robots.txt`), fetchText(`${origin}/llms.txt`)]);
  const robots = robotsRaw && robotsRaw.status < 400 ? robotsRaw.html : null;
  const home = homeRaw && homeRaw.status < 400 ? parsePage(homeRaw) : null;
  const fromSitemap = await sitemapUrls(origin, robots, maxPages * 3);

  // Prefer sitemap URLs; fall back to links found on the homepage.
  const candidates = [...new Set([...fromSitemap, ...(home?.internalLinks ?? [])])]
    .filter((x) => x.replace(/\/$/, "") !== (home?.url ?? url).replace(/\/$/, ""))
    .slice(0, Math.max(0, maxPages - 1));

  const pages = (
    await pool(candidates, 5, async (c) => {
      const r = await fetchText(c);
      return r && r.status < 400 && r.html ? parsePage(r) : null;
    })
  ).filter(Boolean) as PageFacts[];

  return {
    origin,
    home,
    pages: home ? [home, ...pages] : pages,
    robots,
    llmsTxt: Boolean(llms && llms.status < 400 && llms.html.trim().length > 20 && !/<html/i.test(llms.html)),
    sitemapUrls: fromSitemap,
    https: (homeRaw?.url ?? url).startsWith("https://"),
  };
}
