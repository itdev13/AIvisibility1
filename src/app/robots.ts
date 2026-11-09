import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

/** Private areas stay out of search. AI crawlers are named explicitly so there's no doubt we welcome them. */
const PRIVATE = ["/app", "/admin", "/api/", "/onboarding", "/report/", "/login", "/signup"];
const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Bingbot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${SITE.url()}/sitemap.xml`,
    host: SITE.url(),
  };
}
