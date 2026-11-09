import { env } from "./env";
import { postJson } from "./ai/http";

export const apifyAvailable = () => Boolean(env.apifyToken());

/**
 * Run an Apify actor synchronously and return its dataset items.
 * Actor ids use the "username~actor-name" form.
 */
export async function runActor<T = any>(actor: string, input: unknown, timeoutSecs = 240): Promise<T[]> {
  if (!env.apifyToken()) throw new Error("APIFY_TOKEN not set");
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items?timeout=${timeoutSecs}&clean=true`;
  const items = await postJson<T[]>(url, input, { authorization: `Bearer ${env.apifyToken()}` }, {
    timeoutMs: (timeoutSecs + 30) * 1000,
    retries: 1,
  });
  return Array.isArray(items) ? items : [];
}

/* ───────── Google SERP (organic + AI Overview, optional AI Mode) ───────── */

export interface SerpResult {
  organic: { position: number; title: string; url: string; description: string }[];
  aiOverview: { text: string; sources: string[] } | null;
  aiMode: { text: string; sources: string[] } | null;
  peopleAlsoAsk: string[];
}

const urls = (list: unknown): string[] =>
  (Array.isArray(list) ? list : []).map((s: any) => (typeof s === "string" ? s : s?.url ?? s?.link)).filter(Boolean);

/** One Google search. AI Overview and AI Mode are paid add-ons on apify/google-search-scraper. */
export async function googleSerp(query: string, o: { aiMode?: boolean; countryCode?: string } = {}): Promise<SerpResult> {
  const items = await runActor<any>(env.apifySerpActor(), {
    queries: query,
    countryCode: o.countryCode ?? "us",
    maxPagesPerQuery: 1,
    mobileResults: false,
    includeUnfilteredResults: false,
    saveHtml: false,
    saveHtmlToKeyValueStore: false,
    aiOverview: { scrapeFullAiOverview: true },
    aiModeSearch: { enableAiMode: Boolean(o.aiMode) },
  });
  const page = items[0] ?? {};
  const organic = (page.organicResults ?? []).map((r: any, i: number) => ({
    position: r.position ?? i + 1,
    title: r.title ?? "",
    url: r.url ?? "",
    description: r.description ?? "",
  }));
  const aio = page.aiOverview;
  const aim = page.aiModeResult;
  return {
    organic,
    aiOverview: aio?.content ? { text: String(aio.content), sources: urls(aio.sources) } : null,
    aiMode: aim?.text ? { text: String(aim.text), sources: urls(aim.sources) } : null,
    peopleAlsoAsk: (page.peopleAlsoAsk ?? []).map((p: any) => p.question).filter(Boolean),
  };
}

/** Generic AI-chat actor (AI Mode, Copilot). Picks the most answer-like string field. */
export async function aiChatActor(actor: string, query: string): Promise<{ text: string; sources: string[] }> {
  const items = await runActor<any>(actor, { query, queries: [query], prompt: query, prompts: [query] });
  const item = items[0] ?? {};
  const text: string =
    item.answer ?? item.response ?? item.text ?? item.content ?? item.aiModeAnswer ?? item.markdown ?? JSON.stringify(item).slice(0, 4000);
  const raw = item.sources ?? item.citations ?? item.references ?? [];
  const sources = (Array.isArray(raw) ? raw : []).map((s: any) => (typeof s === "string" ? s : s.url ?? s.link)).filter(Boolean);
  return { text: String(text), sources };
}

/* ───────── Reddit search ───────── */

export interface RedditThread {
  title: string;
  url: string;
  community: string;
  body: string;
  upVotes: number;
  numberOfComments: number;
}

export async function redditSearch(query: string, max = 10): Promise<RedditThread[]> {
  const items = await runActor<any>(env.apifyRedditActor(), {
    searches: [query],
    type: "post",
    sort: "relevance",
    maxItems: max,
    maxPostCount: max,
    skipComments: true,
    searchPosts: true,
    searchComments: false,
    searchCommunities: false,
    searchUsers: false,
    proxy: { useApifyProxy: true },
  });
  return items
    .filter((i) => i.url && (i.dataType ?? "post") === "post")
    .map((i) => ({
      title: i.title ?? "",
      url: i.url,
      community: i.communityName ?? i.parsedCommunityName ?? "",
      body: (i.body ?? "").slice(0, 400),
      upVotes: i.upVotes ?? 0,
      numberOfComments: i.numberOfComments ?? 0,
    }));
}
