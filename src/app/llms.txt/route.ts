import { PLAN_LIST } from "@/lib/plans";
import { ENGINE_META } from "@/lib/engines/types";
import { SHOW_PRICING, SITE, abs } from "@/lib/seo";

export const dynamic = "force-static";

/** llms.txt: a plain-language summary of BayClusterLab for AI models (https://llmstxt.org). */
export function GET() {
  const engines = Object.values(ENGINE_META).map((e) => e.label).join(", ");
  const plans = PLAN_LIST.map((p) => `- ${p.name}, $${p.price}/month: ${p.features.join("; ")}.`).join("\n");
  const body = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description}`,
    "",
    "BayClusterLab is a done-for-you service for small businesses such as clinics, law and accounting firms, home services, salons, restaurants, local shops and agencies. Customers increasingly ask AI assistants which business to choose; BayClusterLab makes sure its clients are the ones named. The client tells us about their business once and approves content; BayClusterLab does the rest.",
    "",
    "## What BayClusterLab does",
    `- Tracks a set of real buyer questions every day on ${engines}, and records whether the client is named, at what position, whether their site is cited, and which competitors are named instead.`,
    "- Audits the client's website for AI crawler access, rendering, structured data, page structure and trust signals, then ships the fixes.",
    "- Writes answer-first articles, comparison pages and page rewrites. Every piece is edited by a person and approved by the client before it is published.",
    "- Completes and corrects the business's listings and review profiles (Google Business, Yelp, industry directories), which AI uses to judge trust.",
    "- Shows all of this on a live client dashboard, with AI referral traffic from Google Analytics.",
    "",
    ...(SHOW_PRICING ? ["## Plans (USD, billed monthly, no setup fee, cancel any time)", plans, ""] : ["## Pricing", "A fixed monthly price agreed after a free check. No setup fee and no long contract.", ""]),
    "## Key pages",
    `- [Home](${abs("/")}): what BayClusterLab does and how it works`,
    ...(SHOW_PRICING ? [`- [Pricing](${abs("/pricing")}): plans and a full comparison`] : []),
    `- [Talk to us](${abs("/#contact")}): tell us about your business and get a plan`,
    `- [Free AI visibility check](${abs("/check")}): enter a website and see how often AI recommends it, in about two minutes, free`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
