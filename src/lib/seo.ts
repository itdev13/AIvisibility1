import { env } from "./env";
import { PLAN_LIST } from "./plans";

/**
 * Public-site switches. While we sell done-for-you to small businesses through conversations,
 * prices and self-serve sign-up stay hidden. Flip to true to bring them back; nothing else changes.
 */
export const SHOW_PRICING = false;
export const SHOW_LOGIN = false;

/** One source of truth for how Mentiq describes itself to search engines and AI crawlers. */
export const SITE = {
  name: "Mentiq AI",
  shortName: "Mentiq",
  tagline: "Get recommended when buyers ask AI",
  description:
    "Mentiq gets small businesses recommended when customers ask AI. We check what Claude, ChatGPT, Gemini, Perplexity and Google's AI say about you, then do all the work to get you named: website fixes, content, listings and a monthly report.",
  url: () => env.appUrl(),
};

/** Public, indexable pages. Everything else (app, admin, reports, auth) stays out of search. */
export const PUBLIC_PAGES = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  ...(SHOW_PRICING ? [{ path: "/pricing", priority: 0.9, changeFrequency: "monthly" as const }] : []),
  { path: "/check", priority: 0.9, changeFrequency: "monthly" as const },
];

export const abs = (path: string) => `${SITE.url()}${path === "/" ? "" : path}` || "/";

/** schema.org graph shared by every public page: who we are and what the site is. */
export function siteGraph() {
  const url = SITE.url();
  return [
    {
      "@type": "Organization",
      "@id": `${url}/#org`,
      name: SITE.name,
      alternateName: SITE.shortName,
      url,
      logo: `${url}/icon.svg`,
      description: SITE.description,
      slogan: "When buyers ask AI, be the answer.",
      knowsAbout: ["Generative engine optimization", "Answer engine optimization", "AI search visibility", "Search engine optimization", "AI Overviews"],
    },
    {
      "@type": "WebSite",
      "@id": `${url}/#website`,
      url,
      name: SITE.name,
      description: SITE.description,
      publisher: { "@id": `${url}/#org` },
      inLanguage: "en",
    },
  ];
}

/** The service and its three plans as priced offers. */
export function serviceSchema() {
  const url = SITE.url();
  return {
    "@type": "Service",
    "@id": `${url}/#service`,
    name: "Done-for-you AI search visibility for small businesses",
    serviceType: "AI search optimization",
    provider: { "@id": `${url}/#org` },
    areaServed: "Worldwide",
    audience: { "@type": "BusinessAudience", name: "Small businesses" },
    description:
      "We check what AI assistants say about your business every day, fix your website so AI can read it, write content that answers your customers' questions, tidy your listings and reviews, and send a plain-English report each month.",
    ...(SHOW_PRICING ? { offers: PLAN_LIST.map((p) => ({
      "@type": "Offer",
      name: `${p.name} plan`,
      description: p.features.join(". "),
      price: p.price,
      priceCurrency: "USD",
      url: `${url}/signup?plan=${p.id}`,
      priceSpecification: { "@type": "UnitPriceSpecification", price: p.price, priceCurrency: "USD", unitText: "MONTH", billingDuration: "P1M" },
    })) } : {}),
  };
}

export function faqSchema(faq: [string, string][]) {
  return {
    "@type": "FAQPage",
    mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
}

export function breadcrumb(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  };
}
