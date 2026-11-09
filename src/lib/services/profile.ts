import { generateJson, llmAvailable } from "../ai/llm";
import type { PageFacts } from "../audit/crawl";
import { domainOf } from "../utils";

export interface BusinessProfile {
  brand: string;
  category: string;
  description: string;
  location: string;
  audience: string;
  competitors: { name: string; domain: string }[];
}

/** Infer who the business is from its homepage. Falls back to the <title> when no LLM is configured. */
export async function inferProfile(url: string, home: PageFacts | null): Promise<BusinessProfile> {
  const domain = domainOf(url);
  const fallbackBrand = (home?.title.split(/[|\-–—:]/)[0].trim() || domain.split(".")[0]).slice(0, 60);
  if (!llmAvailable() || !home) {
    return { brand: fallbackBrand, category: "", description: home?.metaDescription ?? "", location: "", audience: "", competitors: [] };
  }
  const p = await generateJson<BusinessProfile>(
    `You are profiling a business from its website so we can check how AI assistants talk about it.

Website: ${url}
Title: ${home.title}
Meta description: ${home.metaDescription}
Headings: ${[...home.h1, ...home.h2].slice(0, 20).join(" | ")}
Homepage text (truncated):
"""
${home.text.slice(0, 6000)}
"""

Return JSON:
{
  "brand": "the brand name customers use",
  "category": "what they sell, as a buyer would search it, e.g. 'family dental clinic', 'HR software for startups'",
  "description": "one sentence on what they do and for whom",
  "location": "city/region if the business serves a local area, else ''",
  "audience": "who buys from them",
  "competitors": [{"name": "...", "domain": "..."}]  // 3-6 real, well-known direct competitors in the same market and geography; [] if unsure
}`,
    { maxTokens: 900 },
  );
  return {
    brand: p.brand || fallbackBrand,
    category: p.category ?? "",
    description: p.description ?? "",
    location: p.location ?? "",
    audience: p.audience ?? "",
    competitors: (p.competitors ?? []).filter((c) => c?.name).slice(0, 10).map((c) => ({ name: c.name, domain: c.domain ? domainOf(c.domain) : "" })),
  };
}

export interface GeneratedQuestion {
  text: string;
  intent: "discovery" | "comparison" | "problem" | "local" | "brand";
}

/**
 * Buyer questions are the heart of tracking: the real things a prospect would type
 * into ChatGPT when looking for this kind of business. Never mention the brand by name
 * (except a few "brand" questions) so we measure unprompted recommendation.
 */
export async function generateQuestions(
  p: { brand: string; category: string; description?: string; location?: string; audience?: string; competitors?: { name: string }[] },
  count: number,
  existing: string[] = [],
): Promise<GeneratedQuestion[]> {
  if (!llmAvailable()) {
    const c = p.category || "provider";
    const loc = p.location ? ` in ${p.location}` : "";
    const fallback: GeneratedQuestion[] = [
      { text: `What is the best ${c}${loc}?`, intent: "discovery" },
      { text: `Can you recommend a good ${c}${loc}?`, intent: "discovery" },
      { text: `Which ${c} has the best reviews${loc}?`, intent: "discovery" },
      { text: `What should I look for when choosing a ${c}?`, intent: "problem" },
      { text: `Top ${c} options compared`, intent: "comparison" },
    ];
    return fallback.slice(0, count);
  }
  const out: GeneratedQuestion[] = [];
  const seen = new Set(existing.map((q) => q.toLowerCase()));
  // Generate in batches of 50 to keep each reply reliable.
  while (out.length < count) {
    const n = Math.min(50, count - out.length);
    const batch = await generateJson<GeneratedQuestion[]>(
      `Write ${n} realistic questions a potential customer would ask an AI assistant (Claude, ChatGPT, Gemini, Perplexity) when looking for this kind of business.

Business: ${p.brand}
Category: ${p.category}
What they do: ${p.description ?? ""}
Who buys: ${p.audience ?? ""}
Location: ${p.location || "not location-specific"}
Known competitors: ${(p.competitors ?? []).map((c) => c.name).join(", ") || "unknown"}

Rules:
- Phrase them the way real people talk to AI: natural, specific, often with context ("I run a 20-person agency…").
- DO NOT mention ${p.brand} by name, except in at most ${Math.max(1, Math.round(n * 0.06))} "brand" questions (e.g. "Is ${p.brand} any good?").
- Mix intents: ~45% discovery ("best X for Y"), ~25% comparison ("X vs Y", "alternatives to <competitor>"), ~20% problem-led ("how do I fix…"), plus local ("near me", city) if location-specific.
- No duplicates or near-duplicates${seen.size ? ` and none of these existing ones: ${[...seen].slice(0, 60).join(" | ")}` : ""}.

Return a JSON array: [{"text": "...", "intent": "discovery|comparison|problem|local|brand"}]`,
      { maxTokens: 4000, temperature: 0.7 },
    );
    let added = 0;
    for (const q of batch ?? []) {
      const t = String(q?.text ?? "").trim();
      if (!t || seen.has(t.toLowerCase())) continue;
      seen.add(t.toLowerCase());
      out.push({ text: t, intent: ["discovery", "comparison", "problem", "local", "brand"].includes(q.intent) ? q.intent : "discovery" });
      added++;
      if (out.length >= count) break;
    }
    if (!added) break;
  }
  return out;
}
