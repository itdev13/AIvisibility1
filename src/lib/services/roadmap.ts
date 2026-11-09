import { db } from "../db";
import { generateJson, llmAvailable } from "../ai/llm";
import { Client, Fix, Snapshot, logActivity, type ClientDoc } from "../models";
import { getPlan } from "../plans";

interface RoadmapOut {
  summary: string;
  items: { month: number; area: string; title: string; detail: string }[];
}

/** 90-day roadmap from the baseline: tracking snapshot + audit fixes + plan entitlements. */
export async function generateRoadmap(clientId: string) {
  await db();
  const client = await Client.findById(clientId).lean<ClientDoc>();
  const plan = getPlan(client?.plan);
  if (!client || !plan) throw new Error("Client has no plan");
  const snap = await Snapshot.findOne({ clientId }).sort({ date: -1 }).lean();
  const fixes = await Fix.find({ clientId, status: "open" }).sort({ impact: 1 }).limit(15).lean();

  let out: RoadmapOut;
  if (llmAvailable()) {
    out = await generateJson<RoadmapOut>(
      `Write a 90-day AI visibility roadmap for a client of our AI SEO service.

Client: ${client.name} — ${client.category}. ${client.description}
Plan: ${plan.name} (${plan.posts} articles/mo, ${plan.moneyPages} money pages/mo, ${plan.pagesImproved} page improvements/mo, ${plan.offsite ? "off-site work included" : "no off-site work"})
Baseline: named in ${snap ? Math.round((snap.visibility ?? 0) * 100) : "?"}% of AI answers; share of voice ${snap ? Math.round((snap.shareOfVoice ?? 0) * 100) : "?"}%; competitors: ${(client.competitors ?? []).map((c) => c.name).join(", ")}
Top open fixes: ${fixes.map((f) => `${f.title} (${f.impact})`).join("; ")}

Return {"summary": "3 sentences: where they stand, the biggest opportunity, what success looks like at day 90", "items": [{"month": 1|2|3, "area": "Fixes|Content|Authority|Tracking", "title": "...", "detail": "1-2 sentences"}]} with 4-5 items per month. Be concrete and honest — no guaranteed outcomes.`,
      { maxTokens: 2500 },
    );
  } else {
    out = {
      summary: `Baseline captured for ${client.name}. Month one fixes AI access and technical issues; months two and three build content that answers the buyer questions you're missing.`,
      items: [
        ...fixes.slice(0, 4).map((f) => ({ month: 1, area: "Fixes", title: f.title, detail: f.detail.split("\n")[0] })),
        { month: 2, area: "Content", title: `Publish ${plan.posts} answer-first articles`, detail: "Targeting the buyer questions where you're not named yet." },
        { month: 3, area: "Content", title: "Comparison and alternatives pages", detail: "Win the 'X vs Y' and 'best X for Y' questions." },
      ],
    };
  }
  await Client.updateOne({ _id: clientId }, { roadmap: { generatedAt: new Date(), summary: out.summary, items: out.items.slice(0, 18).map((i) => ({ ...i, done: false })) } });
  await logActivity(clientId, "account", "Your 90-day roadmap is ready.", "/app");
  return { items: out.items.length };
}
