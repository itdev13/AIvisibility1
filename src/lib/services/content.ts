import { marked } from "marked";
import mongoose from "mongoose";
import { db } from "../db";
import { generate, generateJson } from "../ai/llm";
import { postJson } from "../ai/http";
import { crawlSite } from "../audit/crawl";
import { Client, Content, Question, TrackingResult, logActivity, type ClientDoc, type ContentDoc } from "../models";
import { getPlan } from "../plans";
import { daysAgo, monthKey, slugify } from "../utils";

/** Questions where the brand is least visible in the last 14 days — that's where content helps most. */
async function weakestQuestions(clientId: string, limit: number) {
  const since = daysAgo(14);
  const agg = await TrackingResult.aggregate<{ _id: mongoose.Types.ObjectId; seen: number; named: number }>([
    { $match: { clientId: new mongoose.Types.ObjectId(clientId), date: { $gte: since }, error: "", empty: { $ne: true } } },
    { $group: { _id: "$questionId", seen: { $sum: 1 }, named: { $sum: { $cond: ["$mentioned", 1, 0] } } } },
    { $sort: { named: 1, seen: -1 } },
    { $limit: limit * 2 },
  ]);
  const ids = agg.map((a) => a._id);
  const qs = await Question.find(ids.length ? { _id: { $in: ids } } : { clientId, active: true }).limit(limit * 2).lean();
  return qs.map((q) => q.text);
}

interface PlannedItem {
  type: "blog" | "money_page" | "refresh";
  title: string;
  targetQuestion: string;
  keywords: string[];
  brief: string;
  sourceUrl?: string;
}

/**
 * Fill this month's content quota for a client. Idempotent per month: only tops up
 * what's missing so re-running never over-delivers.
 */
export async function planMonth(clientId: string, month = monthKey()) {
  await db();
  const client = await Client.findById(clientId).lean<ClientDoc>();
  const plan = getPlan(client?.plan);
  if (!client || !plan) throw new Error("Client has no plan");

  const have = await Content.aggregate<{ _id: string; n: number }>([
    { $match: { clientId: client._id, month } },
    { $group: { _id: "$type", n: { $sum: 1 } } },
  ]);
  const count = (t: string) => have.find((h) => h._id === t)?.n ?? 0;
  const need = { blog: plan.posts - count("blog"), money_page: plan.moneyPages - count("money_page"), refresh: plan.pagesImproved - count("refresh") };
  if (need.blog <= 0 && need.money_page <= 0 && need.refresh <= 0) return { planned: 0 };

  const weak = await weakestQuestions(String(client._id), Math.max(need.blog, 5));
  const existingTitles = (await Content.find({ clientId }).select("title").lean()).map((c) => c.title);

  let refreshCandidates: string[] = [];
  if (need.refresh > 0 && client.website) {
    const crawl = await crawlSite(client.website, 40);
    refreshCandidates = crawl.pages
      .filter((p) => p.url !== crawl.home?.url)
      .sort((a, b) => a.questionHeadings - b.questionHeadings || a.wordCount - b.wordCount)
      .slice(0, need.refresh * 2)
      .map((p) => `${p.url} — "${p.title}" (${p.wordCount} words)`);
  }

  const items = await generateJson<PlannedItem[]>(
    `You are the content strategist for an AI-search (GEO/AEO) agency. Plan this month's content for a client so AI assistants start recommending them.

Client: ${client.name} (${client.domain})
Category: ${client.category}
About: ${client.description}
Audience: ${client.audience}
Location: ${client.location || "n/a"}
Competitors: ${(client.competitors ?? []).map((c) => c.name).join(", ")}

Buyer questions where the client is currently NOT being recommended (highest priority first):
${weak.map((q) => `- ${q}`).join("\n")}

Already produced (don't repeat): ${existingTitles.slice(-60).join(" | ") || "nothing yet"}
${refreshCandidates.length ? `Existing pages that could be improved:\n${refreshCandidates.join("\n")}` : ""}

Produce exactly:
- ${Math.max(0, need.blog)} items of type "blog": in-depth answers to specific buyer questions.
- ${Math.max(0, need.money_page)} items of type "money_page": commercial pages that win recommendations — "best X for Y", "<client> vs <competitor>", "alternatives to <competitor>", service/location pages, pricing explainers.
- ${Math.max(0, need.refresh)} items of type "refresh": improvements to the existing pages above (set sourceUrl to that page's URL).

Each brief (3-6 sentences) must say the angle, what must be covered, the evidence/data to include, and which buyer question it answers.

Return a JSON array: [{"type","title","targetQuestion","keywords":[...],"brief","sourceUrl"}]`,
    { maxTokens: 6000, temperature: 0.6 },
  );

  const quotas = { ...need };
  let planned = 0;
  for (const it of items ?? []) {
    const t = it?.type as keyof typeof quotas;
    if (!(t in quotas) || quotas[t] <= 0 || !it.title) continue;
    quotas[t]--;
    await Content.create({
      clientId,
      month,
      type: t,
      title: it.title,
      slug: slugify(it.title),
      targetQuestion: it.targetQuestion ?? "",
      keywords: (it.keywords ?? []).slice(0, 10),
      brief: it.brief ?? "",
      sourceUrl: t === "refresh" ? it.sourceUrl ?? "" : "",
      status: "planned",
    });
    planned++;
  }
  await Client.updateOne({ _id: clientId }, { lastContentPlanMonth: month });
  if (planned) await logActivity(clientId, "content", `Planned ${planned} pieces of content for ${month}.`, "/app/content");
  return { planned };
}

const GEO_RULES = `Write for both people and AI answer engines:
- Open with a 2–3 sentence direct answer to the target question. No throat-clearing.
- Use H2/H3 headings phrased as the questions buyers actually ask.
- Be specific: concrete numbers, steps, criteria, prices/ranges, timelines. Where you'd need a fact you don't have, write [VERIFY: what to check] so an editor fills it in. Never invent statistics, quotes, studies, awards or customer names.
- Include at least one comparison table or ordered list that an AI could quote.
- Mention the client naturally where it genuinely fits, with clear facts about what they offer and who it's for. No hype, no keyword stuffing, no "As an AI".
- Be fair to competitors. Credible, balanced content is what gets cited.
- End with a short FAQ (4–6 questions) that answers related queries in 1–3 sentences each.
- Use plain Markdown. Start with "# " + the title.`;

/** Draft (or redraft) a planned item; moves it to internal review. */
export async function draftContent(contentId: string) {
  await db();
  const item = await Content.findById(contentId);
  if (!item) throw new Error("Content not found");
  const client = await Client.findById(item.clientId).lean<ClientDoc>();
  if (!client) throw new Error("Client not found");
  item.status = "drafting";
  await item.save();

  let existing = "";
  if (item.type === "refresh" && item.sourceUrl) {
    const crawl = await crawlSite(item.sourceUrl, 1);
    existing = crawl.home?.text.slice(0, 8000) ?? "";
  }

  const kind =
    item.type === "money_page"
      ? "a high-intent commercial page (comparison / best-of / service page)"
      : item.type === "refresh"
        ? "an improved rewrite of an existing page — keep what's accurate, restructure it around buyer questions, fill gaps"
        : "an in-depth article";

  const body = await generate(
    `Write ${kind} for ${client.name} (${client.website}).

Title: ${item.title}
Target buyer question: ${item.targetQuestion}
Keywords to cover naturally: ${item.keywords.join(", ")}
Brief: ${item.brief}

About the client: ${client.description}
Audience: ${client.audience}
Location: ${client.location || "n/a"}
Competitors (be fair): ${(client.competitors ?? []).map((c) => c.name).join(", ")}
${existing ? `\nCurrent page text to improve:\n"""\n${existing}\n"""` : ""}

${GEO_RULES}

Length: ${item.type === "blog" ? "1,400–2,000" : "1,000–1,600"} words.
After the article, on a new line write "---META---" then a meta description under 155 characters.`,
    { maxTokens: 6000, temperature: 0.6, system: "You are a senior B2B/B2C content writer and subject-matter editor." },
  );

  const [md, meta] = body.split(/\n-{3}META-{3}\n?/);
  const faq = [...(md ?? "").matchAll(/^#{2,3}\s+(.+\?)\s*\n+([\s\S]*?)(?=\n#{1,3}\s|$)/gm)]
    .slice(-6)
    .map((m) => ({ q: m[1].trim(), a: m[2].trim().split("\n\n")[0].slice(0, 600) }));

  item.body = (md ?? "").trim();
  item.metaDescription = (meta ?? "").trim().slice(0, 160);
  item.faq = faq;
  item.wordCount = item.body.split(/\s+/).length;
  item.status = "review";
  await item.save();
  return { id: String(item._id), words: item.wordCount };
}

export function needsVerification(body: string) {
  return [...body.matchAll(/\[VERIFY:[^\]]*\]/g)].map((m) => m[0]);
}

export function renderHtml(item: Pick<ContentDoc, "body" | "faq" | "title">) {
  const html = marked.parse(item.body.replace(/^#\s+.+\n/, ""), { async: false }) as string;
  const faq = (item.faq ?? []).length
    ? `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: item.faq!.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      })}</script>`
    : "";
  return html + faq;
}

/** Publish an approved item to the client's WordPress via the REST API (application password). */
export async function publishContent(contentId: string) {
  await db();
  const item = await Content.findById(contentId);
  if (!item) throw new Error("Content not found");
  if (item.status !== "approved") throw new Error("Only approved content can be published");
  if (needsVerification(item.body).length) throw new Error("Resolve all [VERIFY] markers before publishing");
  const client = await Client.findById(item.clientId).lean<ClientDoc>();
  const wp = client?.integrations?.wordpress;
  if (!wp?.url || !wp.username || !wp.appPassword) throw new Error("WordPress isn't connected for this client — publish manually and paste the URL");

  const auth = Buffer.from(`${wp.username}:${wp.appPassword}`).toString("base64");
  const base = wp.url.replace(/\/$/, "");
  const type = item.type === "blog" ? "posts" : "pages";
  const r = await postJson<{ id: number; link: string }>(
    `${base}/wp-json/wp/v2/${type}${item.wpPostId ? `/${item.wpPostId}` : ""}`,
    { title: item.title, content: renderHtml(item), status: "publish", slug: item.slug, excerpt: item.metaDescription },
    { authorization: `Basic ${auth}` },
    { retries: 0 },
  );
  item.wpPostId = r.id;
  item.publishedUrl = r.link;
  item.status = "published";
  item.publishedAt = new Date();
  await item.save();
  await logActivity(item.clientId, "content", `Published “${item.title}”.`, r.link);
  return { url: r.link };
}
