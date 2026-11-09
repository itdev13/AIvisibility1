/**
 * Fill a demo workspace with 45 days of synthetic data so the dashboard can be reviewed
 * without API keys. Everything it creates is named "Demo" and can be removed with --clean.
 *   npm run seed:demo                 → creates demo@mentiq.ai / demo-password
 *   npm run seed:demo -- --clean      → deletes the demo workspace
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { computeMetrics } from "@/lib/analysis/metrics";
import { Activity, Audit, Client, Content, Fix, Opportunity, Question, Snapshot, TrackingResult, Traffic, User } from "@/lib/models";
import { PLANS } from "@/lib/plans";
import type { ActivityDoc, ContentDoc, ContentStatus } from "@/lib/types";
import { runChecks } from "@/lib/audit/rules";
import { daysAgo, monthKey } from "@/lib/utils";

const DEMO_EMAIL = "demo@mentiq.ai";
await db();

const existing = await Client.findOne({ name: "Demo: Northside Physio" });
if (existing) {
  const id = existing._id;
  await Promise.all([Question, TrackingResult, Snapshot, Audit, Fix, Content, Opportunity, Traffic, Activity].map((M: any) => M.deleteMany({ clientId: id })));
  await Client.deleteOne({ _id: id });
  await User.deleteOne({ email: DEMO_EMAIL });
}
if (process.argv.includes("--clean")) {
  console.log("✓ Demo workspace removed");
  await mongoose.disconnect();
  process.exit(0);
}

const competitors = [
  { name: "Peak Motion Clinic", domain: "peakmotion.example", aliases: [] },
  { name: "CoreFit Physio", domain: "corefit.example", aliases: [] },
  { name: "Riverside Rehab", domain: "riversiderehab.example", aliases: [] },
  { name: "Active Life PT", domain: "activelifept.example", aliases: [] },
  { name: "Summit Sports Therapy", domain: "summitsports.example", aliases: [] },
];
const client = await Client.create({
  name: "Demo: Northside Physio",
  website: "https://northsidephysio.example",
  domain: "northsidephysio.example",
  category: "sports physiotherapy clinic",
  description: "Sports injury rehab and return-to-play programmes for amateur and pro athletes.",
  location: "Austin, TX",
  audience: "Runners, team-sport athletes and weekend warriors",
  competitors,
  plan: "scale",
  status: "active",
  onboardedAt: new Date(Date.now() - 45 * 86_400_000),
  lastTrackedAt: new Date(Date.now() - 3 * 3600_000),
  lastAuditAt: new Date(Date.now() - 2 * 86_400_000),
  lastContentPlanMonth: monthKey(),
  roadmap: {
    generatedAt: new Date(Date.now() - 44 * 86_400_000),
    summary: "Northside is rarely named today; Peak Motion owns most answers. The fastest wins are unblocking AI crawlers and adding clinic schema, then publishing answer-first pages for the injury questions where no clinic is named yet.",
    items: [
      { month: 1, area: "Fixes", title: "Unblock GPTBot and PerplexityBot", detail: "robots.txt currently blocks both.", done: true },
      { month: 1, area: "Fixes", title: "Add MedicalBusiness schema", detail: "Name, address, services, hours and reviews.", done: true },
      { month: 1, area: "Content", title: "ACL rehab timeline guide", detail: "Answers the highest-volume question with no clinic named.", done: true },
      { month: 2, area: "Content", title: "Comparison pages vs the top two clinics", detail: "Honest comparisons win 'X vs Y' questions.", done: false },
      { month: 2, area: "Authority", title: "Complete Google, Yelp and Healthgrades profiles", detail: "Consistent NAP data and recent reviews.", done: false },
      { month: 3, area: "Authority", title: "Local running-club partnerships", detail: "Earn mentions on club sites and race pages.", done: false },
      { month: 3, area: "Tracking", title: "Expand to 250 questions", detail: "Add post-surgery and youth-sport questions.", done: false },
    ],
  },
});
const cid = client._id;
await User.create({ email: DEMO_EMAIL, name: "Demo Owner", passwordHash: await bcrypt.hash("demo-password", 10), role: "client", clientId: cid });

const qTexts = [
  ["Who is the best sports physio in Austin for a running injury?", "local"],
  ["How long does ACL rehab take before I can play soccer again?", "problem"],
  ["Peak Motion Clinic vs CoreFit Physio — which is better for athletes?", "comparison"],
  ["Best physiotherapy clinic for shoulder injuries near downtown Austin", "local"],
  ["Do I need a referral to see a physical therapist in Texas?", "problem"],
  ["Which Austin clinics offer gait analysis for runners?", "discovery"],
  ["What's the best treatment for shin splints that won't go away?", "problem"],
  ["Recommend a sports therapy clinic that takes walk-ins in Austin", "discovery"],
  ["Alternatives to Riverside Rehab for post-surgery knee rehab", "comparison"],
  ["Top-rated physical therapists for tennis elbow in Austin", "discovery"],
  ["Is dry needling worth it for hamstring strains?", "problem"],
  ["Best return-to-play program for high school athletes in Austin", "discovery"],
];
const questions = await Question.insertMany(qTexts.map(([text, intent]) => ({ clientId: cid, text, intent, active: true })));
const engines = PLANS.scale.engines.filter((e) => !["ai_mode", "copilot"].includes(e));

// Visibility ramps from ~8% to ~52% over 45 days; competitors drift.
const rand = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};
let seed = 1;
for (let d = 44; d >= 0; d--) {
  const date = daysAgo(d);
  const runId = `demo-${date}`;
  const progress = (44 - d) / 44;
  const rows: any[] = [];
  for (const q of questions) {
    for (const e of engines) {
      const p = 0.08 + progress * 0.45 + (e === "perplexity" ? 0.08 : e === "grok" ? -0.06 : 0);
      const mentioned = rand(seed++) < p;
      const pos = mentioned ? 1 + Math.floor(rand(seed++) * (progress > 0.6 ? 2.2 : 4)) : null;
      const comp = competitors
        .map((c, i) => ({ name: c.name, position: rand(seed++) < [0.55 - progress * 0.12, 0.36, 0.28, 0.18, 0.12][i] ? 1 + Math.floor(rand(seed++) * 4) : 0 }))
        .filter((c) => c.position);
      const brandsRanked = [...(mentioned ? [{ name: "Northside Physio", position: pos! }] : []), ...comp].sort((a, b) => a.position - b.position).map((x) => x.name);
      rows.push({
        clientId: cid, questionId: q._id, runId, date, engine: e,
        answer: d === 0 ? `Here are some well-regarded options in Austin:\n\n${brandsRanked.map((b, i) => `${i + 1}. ${b} — ${i === 0 ? "frequently recommended by local runners" : "a solid alternative"}.`).join("\n")}\n\nIt's worth checking whether each clinic offers a free initial assessment.` : "",
        mentioned, position: pos, brandsRanked, competitorMentions: comp,
        cited: mentioned && rand(seed++) < 0.5, citations: mentioned ? ["https://northsidephysio.example/acl-rehab"] : ["https://peakmotion.example"],
        sentiment: mentioned ? "positive" : null, error: "", empty: false,
      });
    }
  }
  if (d <= 2) await TrackingResult.insertMany(rows);
  const m = computeMetrics(rows, competitors.map((c) => c.name));
  await Snapshot.create({ clientId: cid, date, runId, ...m });
  const ai = Math.round(4 + progress * 38 + rand(seed++) * 6);
  await Traffic.create({
    clientId: cid, date, clicks: Math.round(60 + progress * 40 + rand(seed++) * 15), impressions: Math.round(2400 + progress * 900 + rand(seed++) * 300), position: 14 - progress * 4,
    sessions: 300 + ai * 3, aiSessions: ai, aiBySource: { "chatgpt.com": Math.round(ai * 0.55), "perplexity.ai": Math.round(ai * 0.25), "gemini.google.com": Math.round(ai * 0.12), "copilot.microsoft.com": Math.round(ai * 0.08) },
    conversions: 12, aiConversions: Math.round(ai * 0.09),
  });
}

// Audit using the real rules engine against a synthetic crawl.
const page = (url: string, extra: Partial<any> = {}) => ({
  url, status: 200, ms: 900, title: "Northside Physio | Sports Injury Rehab Austin", metaDescription: "", h1: ["Sports physio in Austin"], h2: ["Our services", "How long does recovery take?"], canonical: url,
  noindex: false, lang: "en", wordCount: 420, rawTextChars: 2800, scriptCount: 12, jsonLdTypes: [], hasOg: true, imgCount: 8, imgMissingAlt: 5, questionHeadings: 1,
  hasDate: false, hasAuthor: false, hasTable: false, hasList: true, internalLinks: [], text: "", ...extra,
});
const crawl = {
  origin: "https://northsidephysio.example",
  home: page("https://northsidephysio.example", { jsonLdTypes: ["MedicalBusiness"] }),
  pages: [page("https://northsidephysio.example", { jsonLdTypes: ["MedicalBusiness"] }), page("https://northsidephysio.example/acl-rehab", { wordCount: 1800, questionHeadings: 6, hasDate: true, hasAuthor: true, jsonLdTypes: ["Article"] }), page("https://northsidephysio.example/services", { wordCount: 180 }), page("https://northsidephysio.example/team", { wordCount: 240, h1: [] })],
  robots: "User-agent: CCBot\nDisallow: /\n\nUser-agent: *\nAllow: /",
  llmsTxt: false, sitemapUrls: ["https://northsidephysio.example/acl-rehab"], https: true,
};
const audit = runChecks(crawl as any);
const a = await Audit.create({ clientId: cid, url: client.website, score: audit.score, pagesScanned: 38, checks: audit.checks, aiBots: audit.aiBots });
await Fix.insertMany(audit.fixes.map((f, i) => ({ clientId: cid, auditId: a._id, ...f, page: f.page ?? "", status: i % 4 === 1 ? "in_progress" : "open" })));
await Fix.insertMany([
  { clientId: cid, key: "demo-ai-bots", title: "Unblock AI assistant crawlers in robots.txt", detail: "GPTBot and PerplexityBot were blocked.", area: "ai-access", impact: "high", owner: "client", status: "done", doneAt: new Date(Date.now() - 40 * 86_400_000) },
  { clientId: cid, key: "demo-schema", title: "Add Organization / LocalBusiness schema", detail: "Added MedicalBusiness JSON-LD.", area: "schema", impact: "high", owner: "mentiq", status: "done", doneAt: new Date(Date.now() - 35 * 86_400_000) },
]);

const body = `# How Long Does ACL Rehab Take Before You Can Play Again?

Most athletes return to sport **9–12 months** after ACL reconstruction. The timeline depends on passing strength and hop tests, not on the calendar. [VERIFY: confirm the clinic's average return-to-play time]

## What are the stages of ACL rehab?

| Phase | Weeks | Goal |
|---|---|---|
| Protection | 0–2 | Reduce swelling, regain extension |
| Strength | 3–12 | Rebuild quad and hamstring strength |
| Running | 12–20 | Straight-line running, then change of direction |
| Return to sport | 24+ | Pass testing, train with your team |

## How does Northside Physio approach ACL recovery?

Northside Physio runs a criteria-based programme with monthly strength testing, so you progress when your knee is ready.

## FAQ

### Can I speed up ACL rehab?
Consistency matters more than intensity. Skipping phases raises re-injury risk.
`;
const contentDefs: [string, ContentDoc["type"], ContentStatus][] = [
  ["How Long Does ACL Rehab Take Before You Can Play Again?", "blog", "published"],
  ["Shin Splints That Won't Go Away: What Actually Works", "blog", "published"],
  ["Northside Physio vs Peak Motion Clinic: An Honest Comparison", "money_page", "client_review"],
  ["Best Sports Physio in Austin for Runners (2026 Guide)", "money_page", "approved"],
  ["Gait Analysis in Austin: What It Is and Who Needs It", "blog", "review"],
  ["Tennis Elbow Treatment Options Compared", "blog", "drafting"],
  ["Do You Need a Referral for PT in Texas?", "blog", "planned"],
  ["Services page: Sports injury rehab", "refresh", "published"],
];
for (const [title, type, status] of contentDefs)
  await Content.create({
    clientId: cid, month: monthKey(), type, title, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), status,
    targetQuestion: qTexts[Math.floor(Math.random() * qTexts.length)][0], brief: "Answer-first guide targeting a question where no clinic is named yet.",
    body: ["planned", "drafting"].includes(status) ? "" : status === "review" ? body : body.replace(/ \[VERIFY:[^\]]*\]/, ""),
    wordCount: ["planned", "drafting"].includes(status) ? 0 : 1640, publishedUrl: status === "published" ? "https://northsidephysio.example/blog/acl-rehab" : "",
  });

await Opportunity.insertMany([
  { clientId: cid, type: "directory", title: "Claim / complete Google Business Profile", url: "https://business.google.com", status: "done" },
  { clientId: cid, type: "directory", title: "Claim / complete Yelp for Business profile", url: "https://biz.yelp.com", status: "in_progress" },
  { clientId: cid, type: "reddit", title: "Any good sports physios in Austin? Knee keeps flaring up after long runs", url: "https://www.reddit.com/r/Austin/comments/demo1", snippet: "r/Austin · 48 upvotes · 31 comments", question: qTexts[0][0], score: 110 },
  { clientId: cid, type: "reddit", title: "ACL rehab month 4 — when did you start running again?", url: "https://www.reddit.com/r/ACL/comments/demo2", snippet: "r/ACL · 120 upvotes · 64 comments", question: qTexts[1][0], score: 248 },
  { clientId: cid, type: "quora", title: "What is the best way to recover from shin splints?", url: "https://www.quora.com/demo3", snippet: "Ranks #3 on Google for 'shin splints treatment'", question: qTexts[6][0], score: 7 },
]);

const acts: [ActivityDoc["kind"], string, number][] = [
  ["tracking", "Checked 12 buyer questions across 7 AI engines — named in 52% of answers.", 0.1],
  ["content", "“Northside Physio vs Peak Motion Clinic” is ready for your approval.", 0.4],
  ["content", "Published “Shin Splints That Won't Go Away: What Actually Works”.", 2],
  ["audit", "Audited 38 pages — AI-readiness 71/100, 9 open fixes, 2 verified fixed.", 2],
  ["offsite", "Found 5 new off-site opportunities (listings, Reddit, Quora).", 3],
  ["fix", "Fixed: Add Organization / LocalBusiness schema", 35],
  ["fix", "Fixed: Unblock AI assistant crawlers in robots.txt", 40],
  ["account", "Your 90-day roadmap is ready.", 44],
];
for (const [kind, message, days] of acts) await Activity.create({ clientId: cid, kind, message, createdAt: new Date(Date.now() - days * 86_400_000) });

console.log(`✓ Demo workspace ready. Sign in as ${DEMO_EMAIL} / demo-password`);
await mongoose.disconnect();
