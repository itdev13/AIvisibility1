import { env } from "../env";
import { HttpError, postJson } from "../ai/http";
import { aiChatActor, apifyAvailable, googleSerp, type SerpResult } from "../apify";
import { ENGINE_META, type AskContext, type Engine, type EngineAnswer, type EngineId } from "./types";

export * from "./types";

/**
 * Every engine is asked the question the way a buyer would ask it — no system prompt
 * steering towards any brand — with live web search turned on where the API supports it,
 * so answers approximate what people see in the consumer apps.
 */
const phrase = (q: string, ctx: AskContext) => (ctx.location ? `${q} (I'm based in ${ctx.location}.)` : q);

const uniq = (a: string[]) => [...new Set(a.filter(Boolean))];

/* ───────── OpenAI-compatible Responses API (ChatGPT, Grok) ───────── */
async function responsesApi(base: string, key: string, model: string, input: string): Promise<EngineAnswer> {
  const call = (tool: string) =>
    postJson(`${base}/responses`, { model, input, tools: [{ type: tool }] }, { authorization: `Bearer ${key}` }, { timeoutMs: 120_000 });
  let r: any;
  try {
    r = await call("web_search");
  } catch (e) {
    // Older deployments only know the preview tool name.
    if (e instanceof HttpError && e.status === 400) r = await call("web_search_preview");
    else throw e;
  }
  const texts: string[] = [];
  const cites: string[] = [];
  for (const item of r.output ?? []) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) {
      if (c.type === "output_text") {
        texts.push(c.text ?? "");
        for (const a of c.annotations ?? []) if (a.url) cites.push(a.url);
      }
    }
  }
  return { text: texts.join("\n") || r.output_text || "", citations: uniq(cites) };
}

const chatgpt: Engine = {
  id: "chatgpt",
  ...ENGINE_META.chatgpt,
  available: () => Boolean(env.openaiKey()),
  ask: (q, ctx) => responsesApi("https://api.openai.com/v1", env.openaiKey(), env.openaiModel(), phrase(q, ctx)),
};

const grok: Engine = {
  id: "grok",
  ...ENGINE_META.grok,
  available: () => Boolean(env.xaiKey()),
  ask: async (q, ctx) => {
    try {
      return await responsesApi("https://api.x.ai/v1", env.xaiKey(), env.xaiModel(), phrase(q, ctx));
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      const r = await postJson(
        "https://api.x.ai/v1/chat/completions",
        { model: env.xaiModel(), messages: [{ role: "user", content: phrase(q, ctx) }] },
        { authorization: `Bearer ${env.xaiKey()}` },
      );
      return { text: r.choices?.[0]?.message?.content ?? "", citations: uniq(r.citations ?? []) };
    }
  },
};

/* ───────── Gemini with Google Search grounding ───────── */
const gemini: Engine = {
  id: "gemini",
  ...ENGINE_META.gemini,
  available: () => Boolean(env.geminiKey()),
  ask: async (q, ctx) => {
    const r = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel()}:generateContent?key=${env.geminiKey()}`,
      { contents: [{ role: "user", parts: [{ text: phrase(q, ctx) }] }], tools: [{ google_search: {} }] },
      {},
      { timeoutMs: 120_000 },
    );
    const cand = r.candidates?.[0];
    const text = (cand?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
    const chunks = cand?.groundingMetadata?.groundingChunks ?? [];
    // Grounding URIs are Google redirect links; the title usually carries the real domain.
    const citations = chunks.map((c: any) => c.web?.title && /\./.test(c.web.title) ? `https://${c.web.title}` : c.web?.uri).filter(Boolean);
    return { text, citations: uniq(citations) };
  },
};

/* ───────── Perplexity Sonar ───────── */
const perplexity: Engine = {
  id: "perplexity",
  ...ENGINE_META.perplexity,
  available: () => Boolean(env.perplexityKey()),
  ask: async (q, ctx) => {
    const r = await postJson(
      "https://api.perplexity.ai/chat/completions",
      { model: env.perplexityModel(), messages: [{ role: "user", content: phrase(q, ctx) }] },
      { authorization: `Bearer ${env.perplexityKey()}` },
      { timeoutMs: 120_000 },
    );
    const cites = [...(r.citations ?? []), ...(r.search_results ?? []).map((s: any) => s.url)];
    return { text: r.choices?.[0]?.message?.content ?? "", citations: uniq(cites) };
  },
};

/* ───────── Claude with web search ───────── */
const claude: Engine = {
  id: "claude",
  ...ENGINE_META.claude,
  available: () => Boolean(env.anthropicKey()),
  ask: async (q, ctx) => {
    const r = await postJson(
      "https://api.anthropic.com/v1/messages",
      {
        model: env.anthropicTrackModel(),
        max_tokens: 1500,
        messages: [{ role: "user", content: phrase(q, ctx) }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      },
      { "x-api-key": env.anthropicKey(), "anthropic-version": "2023-06-01" },
      { timeoutMs: 150_000 },
    );
    const texts: string[] = [];
    const cites: string[] = [];
    for (const b of r.content ?? []) {
      if (b.type === "text") {
        texts.push(b.text ?? "");
        for (const c of b.citations ?? []) if (c.url) cites.push(c.url);
      }
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const c of b.content) if (c.url) cites.push(c.url);
      }
    }
    return { text: texts.join(""), citations: uniq(cites) };
  },
};

/* ───────── Google (organic + AI Overview) via Apify, one SERP fetch shared by both ───────── */
const serpCache = new Map<string, { at: number; p: Promise<SerpResult> }>();
function serp(q: string, aiMode = false) {
  const key = `${aiMode ? "aim" : "std"}:${q}`;
  const hit = serpCache.get(key);
  if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.p;
  const p = googleSerp(q, { aiMode });
  p.catch(() => serpCache.delete(key));
  serpCache.set(key, { at: Date.now(), p });
  if (serpCache.size > 2000) serpCache.delete(serpCache.keys().next().value!);
  return p;
}

const google: Engine = {
  id: "google",
  ...ENGINE_META.google,
  available: apifyAvailable,
  ask: async (q) => {
    const r = await serp(q);
    return {
      text: r.organic.map((o) => `${o.position}. ${o.title} — ${o.url}\n${o.description}`).join("\n"),
      citations: r.organic.map((o) => o.url),
      rankedUrls: r.organic.map((o) => o.url),
    };
  },
};

const googleAio: Engine = {
  id: "google_aio",
  ...ENGINE_META.google_aio,
  available: apifyAvailable,
  ask: async (q) => {
    const r = await serp(q);
    if (!r.aiOverview) return { text: "", citations: [], empty: true };
    return { text: r.aiOverview.text, citations: r.aiOverview.sources };
  },
};

/* ───────── Engines without public APIs: configurable Apify actors ───────── */
const actorEngine = (id: EngineId, actor: () => string): Engine => ({
  id,
  ...ENGINE_META[id],
  available: () => apifyAvailable() && Boolean(actor()),
  ask: async (q, ctx) => {
    const r = await aiChatActor(actor(), phrase(q, ctx));
    return { text: r.text, citations: r.sources };
  },
});

export const ENGINES: Record<EngineId, Engine> = {
  claude,
  chatgpt,
  gemini,
  perplexity,
  google,
  google_aio: googleAio,
  // AI Mode: a custom actor if configured, otherwise the SERP actor's AI Mode add-on.
  ai_mode: env.apifyAiModeActor()
    ? actorEngine("ai_mode", env.apifyAiModeActor)
    : {
        id: "ai_mode",
        ...ENGINE_META.ai_mode,
        available: apifyAvailable,
        ask: async (q) => {
          const r = await serp(q, true);
          if (!r.aiMode) return { text: "", citations: [], empty: true };
          return { text: r.aiMode.text, citations: r.aiMode.sources };
        },
      },
  copilot: actorEngine("copilot", env.apifyCopilotActor),
  grok,
};

export const ALL_ENGINE_IDS = Object.keys(ENGINES) as EngineId[];

export function availableEngines(ids: EngineId[] = ALL_ENGINE_IDS): Engine[] {
  return ids.map((id) => ENGINES[id]).filter((e) => e && e.available());
}
