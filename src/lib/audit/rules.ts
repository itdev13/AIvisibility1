import { AI_BOTS, robotsBlocks, type PageFacts, type SiteCrawl } from "./crawl";

export type Area = "ai-access" | "technical" | "schema" | "content" | "offsite";
export interface Check {
  id: string;
  title: string;
  area: Area;
  status: "pass" | "warn" | "fail";
  detail: string;
  page?: string;
}
export interface FixSuggestion {
  key: string;
  title: string;
  detail: string;
  area: Area;
  impact: "high" | "medium" | "low";
  page?: string;
  owner: "bayclusterlab" | "client";
}

const WEIGHT = { fail: 0, warn: 0.5, pass: 1 } as const;
const AREA_WEIGHT: Record<Area, number> = { "ai-access": 3, schema: 2, content: 2, technical: 1.5, offsite: 1 };

const list = (urls: string[], n = 5) => urls.slice(0, n).map((u) => `• ${u}`).join("\n") + (urls.length > n ? `\n…and ${urls.length - n} more` : "");

/** Turn a crawl into scored checks plus a deduplicated, prioritised fix list. */
export function runChecks(c: SiteCrawl) {
  const checks: Check[] = [];
  const fixes: FixSuggestion[] = [];
  // Judge only pages the site wants found. Pages it marks noindex (logins, carts, thank-you pages)
  // are deliberately hidden, so their thin content or shared titles aren't problems.
  const allPages = c.pages;
  const pages = allPages.filter((p) => !p.noindex || p.url === c.home?.url);
  const home = c.home;
  const add = (ch: Check, fix?: Omit<FixSuggestion, "area" | "key" | "title"> & { key?: string; title?: string }) => {
    checks.push(ch);
    if (fix && ch.status !== "pass") fixes.push({ key: fix.key ?? ch.id, title: fix.title ?? ch.title, area: ch.area, ...fix });
  };

  /* ── AI access ── */
  const aiBots: Record<string, boolean> = {};
  for (const b of AI_BOTS) aiBots[b.ua] = !(c.robots && robotsBlocks(c.robots, b.ua));
  const blocked = AI_BOTS.filter((b) => !aiBots[b.ua] && b.ua !== "CCBot");
  const searchBlocked = blocked.filter((b) => ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Claude-SearchBot", "Googlebot", "Bingbot"].includes(b.ua));
  add(
    {
      id: "ai-bots",
      title: "AI crawlers can read your site",
      area: "ai-access",
      status: searchBlocked.length ? "fail" : blocked.length ? "warn" : "pass",
      detail: blocked.length ? `robots.txt blocks: ${blocked.map((b) => `${b.ua} (${b.owner})`).join(", ")}` : "No AI assistant crawlers are blocked.",
    },
    {
      impact: searchBlocked.length ? "high" : "medium",
      owner: "client",
      title: "Unblock AI assistant crawlers in robots.txt",
      detail: `These crawlers are blocked, so the assistants can't read or cite your pages:\n${blocked.map((b) => `• ${b.ua} — ${b.owner}`).join("\n")}\n\nAdd an explicit "Allow: /" group for each in robots.txt.`,
    },
  );

  add(
    {
      id: "llms-txt",
      title: "llms.txt published",
      area: "ai-access",
      status: c.llmsTxt ? "pass" : "warn",
      detail: c.llmsTxt ? "Found /llms.txt." : "No /llms.txt. It gives AI tools a clean summary of who you are and your key pages.",
    },
    { impact: "low", owner: "bayclusterlab", title: "Publish an llms.txt file", detail: "We'll write an llms.txt that summarises the business, services and the most important URLs, and give it to you to upload at the site root." },
  );

  if (home) {
    const jsHeavy = home.rawTextChars < 600 && home.scriptCount > 8;
    add(
      {
        id: "ssr",
        title: "Content is visible without JavaScript",
        area: "ai-access",
        status: jsHeavy ? "fail" : home.rawTextChars < 1200 ? "warn" : "pass",
        detail: jsHeavy
          ? `Your homepage serves only ${home.rawTextChars} characters of text in its HTML. Most AI crawlers don't run JavaScript, so they see an almost empty page.`
          : `Homepage HTML contains ${home.rawTextChars.toLocaleString()} characters of readable text.`,
        page: home.url,
      },
      {
        impact: "high",
        owner: "client",
        title: "Server-render your key pages",
        detail: "AI crawlers mostly read raw HTML. Enable server-side rendering or pre-rendering so the text of key pages is in the HTML response.",
        page: home.url,
      },
    );
  }

  /* ── Technical ── */
  add(
    { id: "https", title: "Site served over HTTPS", area: "technical", status: c.https ? "pass" : "fail", detail: c.https ? "HTTPS enabled." : "The site isn't served over HTTPS." },
    { impact: "high", owner: "client", title: "Move the site to HTTPS", detail: "Install a TLS certificate and redirect all http:// traffic to https://." },
  );
  add(
    { id: "sitemap", title: "XML sitemap found", area: "technical", status: c.sitemapUrls.length ? "pass" : "warn", detail: c.sitemapUrls.length ? `${c.sitemapUrls.length} URLs listed in the sitemap.` : "No sitemap found at /sitemap.xml or declared in robots.txt." },
    { impact: "medium", owner: "bayclusterlab", title: "Create and submit an XML sitemap", detail: "Generate a sitemap of all indexable pages, reference it in robots.txt and submit it in Search Console." },
  );

  // Nothing fetched (WAF / bot protection / downtime): page checks would "pass" vacuously, so stop here.
  if (!pages.length) {
    add(
      { id: "unreachable", title: "Crawlers can fetch your pages", area: "ai-access", status: "fail", detail: "Every page request was blocked or failed. AI crawlers are likely blocked the same way." },
      { impact: "high", owner: "client", title: "Stop blocking crawlers at the server or firewall", detail: "Bot protection (Cloudflare, a WAF, or the host) is rejecting automated requests. Allow-list verified search and AI crawlers so they can read your pages." },
    );
    return finish(checks, fixes, aiBots);
  }

  const missingTitle = pages.filter((p) => !p.title);
  const longTitle = pages.filter((p) => p.title.length > 65);
  add(
    { id: "titles", title: "Every page has a clear title", area: "technical", status: missingTitle.length ? "fail" : longTitle.length > pages.length / 3 ? "warn" : "pass", detail: missingTitle.length ? `${missingTitle.length} pages have no <title>.` : longTitle.length ? `${longTitle.length} titles are longer than 65 characters.` : "All titles look good." },
    { impact: missingTitle.length ? "high" : "low", owner: "bayclusterlab", title: "Fix missing and over-long page titles", detail: list([...missingTitle, ...longTitle].map((p) => p.url)) },
  );

  const titleCounts = new Map<string, number>();
  pages.forEach((p) => p.title && titleCounts.set(p.title, (titleCounts.get(p.title) ?? 0) + 1));
  const dupTitles = pages.filter((p) => p.title && (titleCounts.get(p.title) ?? 0) > 1);
  if (pages.length > 3)
    add(
      { id: "dup-titles", title: "Titles are unique", area: "technical", status: dupTitles.length ? "warn" : "pass", detail: dupTitles.length ? `${dupTitles.length} pages share a title with another page.` : "No duplicate titles." },
      { impact: "medium", owner: "bayclusterlab", title: "Make duplicate page titles unique", detail: list(dupTitles.map((p) => `${p.url} — "${p.title}"`)) },
    );

  const noMeta = pages.filter((p) => !p.metaDescription);
  add(
    { id: "meta", title: "Pages have meta descriptions", area: "technical", status: noMeta.length > pages.length / 2 ? "fail" : noMeta.length ? "warn" : "pass", detail: noMeta.length ? `${noMeta.length} of ${pages.length} pages have no meta description.` : "All pages have meta descriptions." },
    { impact: "medium", owner: "bayclusterlab", title: "Write meta descriptions that answer the query", detail: list(noMeta.map((p) => p.url)) },
  );

  const badH1 = pages.filter((p) => p.h1.length !== 1);
  add(
    { id: "h1", title: "One H1 per page", area: "technical", status: badH1.length > pages.length / 2 ? "fail" : badH1.length ? "warn" : "pass", detail: badH1.length ? `${badH1.length} pages have no H1 or more than one.` : "Heading structure looks right." },
    { impact: "medium", owner: "bayclusterlab", title: "Fix H1 headings", detail: list(badH1.map((p) => `${p.url} (${p.h1.length} H1s)`)) },
  );

  // Only a problem when the site's own sitemap lists the page: that's a page they want found.
  const inSitemap = new Set(c.sitemapUrls.map((u) => u.replace(/\/$/, "")));
  const noindex = allPages.filter((p) => p.noindex && inSitemap.has(p.url.replace(/\/$/, "")));
  if (noindex.length)
    add(
      { id: "noindex", title: "Important pages are indexable", area: "technical", status: "warn", detail: `${noindex.length} pages in your sitemap are marked noindex, so search and AI engines will skip them.` },
      { impact: "medium", owner: "bayclusterlab", title: "Review noindexed pages", detail: `Check these are meant to be hidden from search and AI:\n${list(noindex.map((p) => p.url))}` },
    );

  const slow = pages.filter((p) => p.ms > 2500);
  add(
    { id: "speed", title: "Pages respond quickly", area: "technical", status: slow.length > pages.length / 3 ? "warn" : "pass", detail: slow.length ? `${slow.length} pages took over 2.5s to respond.` : "Server response times look fine." },
    { impact: "low", owner: "client", title: "Improve server response time", detail: `Slow pages:\n${list(slow.map((p) => `${p.url} (${(p.ms / 1000).toFixed(1)}s)`))}` },
  );

  const missingAlt = pages.reduce((s, p) => s + p.imgMissingAlt, 0);
  const totalImg = pages.reduce((s, p) => s + p.imgCount, 0);
  if (totalImg > 0)
    add(
      { id: "alt", title: "Images have alt text", area: "technical", status: missingAlt / totalImg > 0.3 ? "warn" : "pass", detail: `${missingAlt} of ${totalImg} images have no alt text.` },
      { impact: "low", owner: "bayclusterlab", title: "Add descriptive alt text to images", detail: list(pages.filter((p) => p.imgMissingAlt > 0).map((p) => `${p.url} (${p.imgMissingAlt} images)`)) },
    );

  /* ── Schema ── */
  const allTypes = new Set(pages.flatMap((p) => p.jsonLdTypes));
  const hasOrg = ["Organization", "LocalBusiness", "Corporation", "ProfessionalService", "Store", "Restaurant", "MedicalBusiness", "LegalService"].some((t) => allTypes.has(t)) || [...allTypes].some((t) => /Business|Service|Organization/.test(t));
  add(
    { id: "schema-org", title: "Organization schema describes the business", area: "schema", status: hasOrg ? "pass" : "fail", detail: hasOrg ? "Organization / LocalBusiness markup found." : "No Organization or LocalBusiness structured data. AI engines use it to confirm who you are." },
    { impact: "high", owner: "bayclusterlab", title: "Add Organization / LocalBusiness schema", detail: "We'll add JSON-LD with your legal name, logo, sameAs profiles, contact details, address and areas served." },
  );
  const anyLd = pages.filter((p) => p.jsonLdTypes.length).length;
  add(
    { id: "schema-coverage", title: "Structured data on key pages", area: "schema", status: anyLd / Math.max(1, pages.length) > 0.6 ? "pass" : anyLd ? "warn" : "fail", detail: `${anyLd} of ${pages.length} pages carry JSON-LD. Types seen: ${[...allTypes].slice(0, 8).join(", ") || "none"}.` },
    { impact: "medium", owner: "bayclusterlab", title: "Add structured data to service, article and product pages", detail: "Mark up services (Service), articles (Article with author + dates), products (Product + reviews) and FAQs (FAQPage)." },
  );
  const faqPages = pages.filter((p) => p.questionHeadings >= 2);
  const faqWithSchema = faqPages.filter((p) => p.jsonLdTypes.includes("FAQPage"));
  if (faqPages.length)
    add(
      { id: "faq-schema", title: "Q&A content is marked up", area: "schema", status: faqWithSchema.length === faqPages.length ? "pass" : "warn", detail: `${faqPages.length} pages use question headings; ${faqWithSchema.length} have FAQPage schema.` },
      { impact: "medium", owner: "bayclusterlab", title: "Add FAQPage schema to Q&A sections", detail: list(faqPages.filter((p) => !p.jsonLdTypes.includes("FAQPage")).map((p) => p.url)) },
    );

  /* ── Content ── */
  const thin = pages.filter((p) => p.wordCount < 300);
  add(
    { id: "thin", title: "Pages have enough substance", area: "content", status: thin.length > pages.length / 2 ? "fail" : thin.length > pages.length / 4 ? "warn" : "pass", detail: `${thin.length} of ${pages.length} pages have under 300 words.` },
    { impact: "medium", owner: "bayclusterlab", title: "Expand thin pages into full answers", detail: `AI engines quote pages that fully answer a question. Expand:\n${list(thin.map((p) => `${p.url} (${p.wordCount} words)`))}` },
  );
  const qa = pages.filter((p) => p.questionHeadings > 0).length;
  add(
    { id: "answer-format", title: "Content is written as answers", area: "content", status: qa / Math.max(1, pages.length) > 0.3 ? "pass" : qa ? "warn" : "fail", detail: `${qa} of ${pages.length} pages use question-style headings that match how buyers ask AI.` },
    { impact: "high", owner: "bayclusterlab", title: "Restructure key pages around buyer questions", detail: "Lead each section with the question buyers ask, answer it in the first two sentences, then add detail, comparisons and proof." },
  );
  const structured = pages.filter((p) => p.hasTable || p.hasList).length;
  add(
    { id: "extractable", title: "Lists and tables AI can quote", area: "content", status: structured / Math.max(1, pages.length) > 0.4 ? "pass" : "warn", detail: `${structured} of ${pages.length} pages use lists or tables.` },
    { impact: "low", owner: "bayclusterlab", title: "Add comparison tables and step lists", detail: "AI answers often lift lists and tables directly. Add them to service, pricing and comparison pages." },
  );
  const dated = pages.filter((p) => p.hasDate).length;
  const authored = pages.filter((p) => p.hasAuthor).length;
  add(
    { id: "eeat", title: "Authors and dates shown", area: "content", status: dated && authored ? "pass" : dated || authored ? "warn" : "fail", detail: `${authored} pages show an author, ${dated} show a published or updated date.` },
    { impact: "medium", owner: "bayclusterlab", title: "Show authors, credentials and updated dates", detail: "Add author bios with credentials and visible “last updated” dates to articles and guides. It signals freshness and expertise." },
  );
  if (home)
    add(
      { id: "og", title: "Social preview tags", area: "technical", status: home.hasOg ? "pass" : "warn", detail: home.hasOg ? "Open Graph tags present." : "No Open Graph tags on the homepage." },
      { impact: "low", owner: "bayclusterlab", title: "Add Open Graph tags", detail: "Add og:title, og:description and og:image so shared links and AI previews show your brand." },
    );

  return finish(checks, fixes, aiBots);
}

/** Score: weighted by area so AI-access issues hurt most. Fixes sorted by impact. */
function finish(checks: Check[], fixes: FixSuggestion[], aiBots: Record<string, boolean>) {
  let num = 0;
  let den = 0;
  for (const ch of checks) {
    num += WEIGHT[ch.status] * AREA_WEIGHT[ch.area];
    den += AREA_WEIGHT[ch.area];
  }
  const score = den ? Math.round((num / den) * 100) : 0;
  const order = { high: 0, medium: 1, low: 2 };
  fixes.sort((a, b) => order[a.impact] - order[b.impact]);
  return { checks, fixes, score, aiBots };
}
