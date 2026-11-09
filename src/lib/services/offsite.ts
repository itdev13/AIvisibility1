import { db } from "../db";
import { apifyAvailable, googleSerp, redditSearch } from "../apify";
import { Client, Opportunity, Question, logActivity, type ClientDoc } from "../models";
import { pool } from "../utils";

/** Directories and review sites AI engines lean on, by business type. Checklist, worked by a specialist. */
const DIRECTORIES = {
  universal: [
    ["Google Business Profile", "https://business.google.com"],
    ["Bing Places", "https://www.bingplaces.com"],
    ["Apple Business Connect", "https://businessconnect.apple.com"],
    ["LinkedIn Company Page", "https://www.linkedin.com/company/setup/new/"],
    ["Crunchbase", "https://www.crunchbase.com"],
    ["Trustpilot", "https://business.trustpilot.com"],
    ["Wikidata entity", "https://www.wikidata.org/wiki/Special:NewItem"],
  ],
  software: [
    ["G2", "https://sell.g2.com"],
    ["Capterra", "https://www.capterra.com/vendors/sign-up"],
    ["Product Hunt", "https://www.producthunt.com"],
    ["AlternativeTo", "https://alternativeto.net"],
  ],
  services: [
    ["Clutch", "https://clutch.co/get-listed"],
    ["Yelp for Business", "https://biz.yelp.com"],
    ["Better Business Bureau", "https://www.bbb.org/get-accredited"],
  ],
} as const;

const isSoftware = (c: ClientDoc) => /software|saas|app|platform|tool|api/i.test(`${c.category} ${c.description}`);

/** Scale plan: find Reddit/Quora threads where buyers ask our questions, plus the listings checklist. */
export async function findOpportunities(clientId: string) {
  await db();
  const client = await Client.findById(clientId).lean<ClientDoc>();
  if (!client) throw new Error("Client not found");
  let created = 0;
  const upsert = async (o: { type: string; title: string; url: string; snippet?: string; question?: string; score?: number }) => {
    const r = await Opportunity.updateOne({ clientId, url: o.url }, { $setOnInsert: { clientId, status: "new", ...o } }, { upsert: true });
    if (r.upsertedCount) created++;
  };

  const dirs = [...DIRECTORIES.universal, ...(isSoftware(client) ? DIRECTORIES.software : DIRECTORIES.services)];
  for (const [name, url] of dirs) await upsert({ type: "directory", title: `Claim / complete ${name} profile`, url, snippet: `Make sure ${client.name}'s profile is complete, consistent (name, address, description) and has recent reviews.` });

  if (apifyAvailable()) {
    const qs = await Question.find({ clientId, active: true, intent: { $in: ["discovery", "comparison", "problem"] } }).limit(8).lean();
    await pool(qs, 2, async (q) => {
      const [reddit, quora] = await Promise.allSettled([redditSearch(q.text, 6), googleSerp(`site:quora.com ${q.text}`)]);
      if (reddit.status === "fulfilled")
        for (const t of reddit.value)
          await upsert({ type: "reddit", title: t.title, url: t.url, snippet: `r/${t.community} · ${t.upVotes} upvotes · ${t.numberOfComments} comments\n${t.body}`, question: q.text, score: t.upVotes + t.numberOfComments * 2 });
      if (quora.status === "fulfilled")
        for (const o of quora.value.organic.filter((x) => x.url.includes("quora.com")).slice(0, 5))
          await upsert({ type: "quora", title: o.title, url: o.url, snippet: o.description, question: q.text, score: 10 - o.position });
    });
  }
  if (created) await logActivity(clientId, "offsite", `Found ${created} new off-site opportunities (listings, Reddit, Quora).`, "/app/offsite");
  return { created };
}
