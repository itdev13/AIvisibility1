import { env } from "../env";
import { generateJson, llmAvailable } from "../ai/llm";
import type { EngineAnswer } from "../engines/types";
import { domainOf, escapeRegex } from "../utils";

export interface Entity {
  name: string;
  domain?: string;
  aliases?: string[];
}

export interface MentionAnalysis {
  mentioned: boolean;
  position: number | null;
  brandsRanked: string[];
  competitorMentions: { name: string; position: number }[];
  cited: boolean;
  citations: string[];
  sentiment: "positive" | "neutral" | "negative" | null;
}

function patterns(e: Entity): RegExp[] {
  const terms = new Set<string>([e.name, ...(e.aliases ?? [])].map((t) => t.trim()).filter((t) => t.length >= 2));
  if (e.domain) {
    const d = domainOf(e.domain);
    terms.add(d);
    // "acme.com" → also match "Acme" if the brand name didn't already cover it
    const root = d.split(".")[0];
    if (root.length >= 4) terms.add(root);
  }
  return [...terms].map((t) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(t)}(?=$|[^\\p{L}\\p{N}])`, "iu"));
}

/** Index of the first mention of the entity in text, or -1. */
export function firstIndex(text: string, e: Entity): number {
  let best = -1;
  for (const re of patterns(e)) {
    const m = re.exec(text);
    if (m && (best < 0 || m.index < best)) best = m.index;
  }
  return best;
}

const sameBrand = (listed: string, e: Entity) => {
  const l = listed.toLowerCase();
  const names = [e.name, ...(e.aliases ?? []), e.domain ? domainOf(e.domain) : ""].filter(Boolean).map((x) => x!.toLowerCase());
  return names.some((n) => n.length >= 2 && (l === n || l.includes(n) || n.includes(l)));
};

const citesDomain = (urls: string[], domain?: string) => {
  if (!domain) return false;
  const d = domainOf(domain);
  return urls.some((u) => {
    const h = domainOf(u);
    return h === d || h.endsWith(`.${d}`);
  });
};

/**
 * Work out whether (and where) the brand appears in an engine's answer.
 * Regex gives presence; an optional cheap LLM pass gives the true ordered list of
 * recommended businesses — including ones we don't track — plus sentiment.
 */
export async function analyzeAnswer(answer: EngineAnswer, brand: Entity, competitors: Entity[]): Promise<MentionAnalysis> {
  const citations = answer.citations ?? [];
  const cited = citesDomain(citations, brand.domain);

  // Classic search: position is the rank of the brand's domain.
  if (answer.rankedUrls) {
    const rank = (e: Entity) => {
      if (!e.domain) return -1;
      const d = domainOf(e.domain);
      return answer.rankedUrls!.findIndex((u) => {
        const h = domainOf(u);
        return h === d || h.endsWith(`.${d}`);
      });
    };
    const r = rank(brand);
    const comp = competitors.map((c) => ({ name: c.name, position: rank(c) + 1 })).filter((c) => c.position > 0);
    return {
      mentioned: r >= 0,
      position: r >= 0 ? r + 1 : null,
      brandsRanked: answer.rankedUrls.map(domainOf),
      competitorMentions: comp,
      cited: r >= 0,
      citations,
      sentiment: null,
    };
  }

  const text = answer.text ?? "";
  if (!text.trim()) {
    return { mentioned: false, position: null, brandsRanked: [], competitorMentions: [], cited, citations, sentiment: null };
  }

  // Regex ordering over tracked entities
  const tracked = [brand, ...competitors]
    .map((e) => ({ e, i: firstIndex(text, e) }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i);
  let brandsRanked = tracked.map((x) => x.e.name);
  let sentiment: MentionAnalysis["sentiment"] = null;
  const regexMentioned = tracked.some((x) => x.e === brand);

  if (env.llmExtraction() && llmAvailable()) {
    try {
      const out = await generateJson<{ brands: string[]; target_sentiment: "positive" | "neutral" | "negative" | "not_mentioned" }>(
        `Below is an AI assistant's answer to a buyer's question.
List every company, product or service provider the answer recommends or names as an option, in the order they first appear. Use their brand names only (no descriptions). Exclude publishers that are only cited as sources.
Then rate how the answer talks about "${brand.name}"${brand.domain ? ` (${domainOf(brand.domain)})` : ""}: positive, neutral, negative, or not_mentioned.

Return {"brands": string[], "target_sentiment": string}.

ANSWER:
"""
${text.slice(0, 8000)}
"""`,
        { fast: true, maxTokens: 600 },
      );
      if (Array.isArray(out.brands) && out.brands.length) brandsRanked = out.brands.map(String).slice(0, 25);
      sentiment = out.target_sentiment === "not_mentioned" ? null : out.target_sentiment ?? null;
    } catch {
      /* fall back to regex ordering */
    }
  }

  const pos = (e: Entity) => {
    const i = brandsRanked.findIndex((b) => sameBrand(b, e));
    return i >= 0 ? i + 1 : null;
  };
  let position = pos(brand);
  const mentioned = regexMentioned || position !== null;
  if (mentioned && position === null) position = brandsRanked.length + 1;

  const competitorMentions = competitors
    .map((c) => ({ name: c.name, position: pos(c) ?? (firstIndex(text, c) >= 0 ? brandsRanked.length + 1 : 0) }))
    .filter((c) => c.position > 0);

  return { mentioned, position: mentioned ? position : null, brandsRanked, competitorMentions, cited, citations, sentiment: mentioned ? sentiment : null };
}
