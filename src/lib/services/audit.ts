import { db } from "../db";
import { crawlSite } from "../audit/crawl";
import { runChecks } from "../audit/rules";
import { Audit, Client, Fix, logActivity, type ClientDoc } from "../models";
import type { PlanId } from "../plans";

const PAGE_BUDGET: Record<PlanId, number> = { starter: 30, growth: 75, scale: 200 };

/** Crawl the client's site, store the audit, and upsert fixes (keeping status on ones already worked on). */
export async function auditClient(clientId: string) {
  await db();
  const client = await Client.findById(clientId).lean<ClientDoc>();
  if (!client?.website) throw new Error("Client has no website");
  const crawl = await crawlSite(client.website, PAGE_BUDGET[(client.plan ?? "starter") as PlanId] ?? 30);
  if (!crawl.pages.length) throw new Error(`Couldn't load ${client.website}`);
  const { checks, fixes, score, aiBots } = runChecks(crawl);

  const audit = await Audit.create({ clientId, url: client.website, score, pagesScanned: crawl.pages.length, checks, aiBots });

  const openKeys = new Set(fixes.map((f) => f.key));
  for (const f of fixes) {
    await Fix.updateOne(
      { clientId, key: f.key },
      {
        $set: { auditId: audit._id, title: f.title, detail: f.detail, area: f.area, impact: f.impact, page: f.page ?? "", owner: f.owner },
        // Re-open a "done" fix only if the audit shows it's broken again.
        $setOnInsert: { status: "open" },
      },
      { upsert: true },
    );
    await Fix.updateOne({ clientId, key: f.key, status: "done" }, { $set: { status: "open", doneAt: null } });
  }
  // Anything previously open that now passes is resolved — verified by the crawler.
  const resolved = await Fix.updateMany(
    { clientId, key: { $nin: [...openKeys] }, status: { $in: ["open", "in_progress"] } },
    { $set: { status: "done", doneAt: new Date() } },
  );

  await Client.updateOne({ _id: clientId }, { lastAuditAt: new Date() });
  await logActivity(
    clientId,
    "audit",
    `Audited ${crawl.pages.length} pages — AI-readiness ${score}/100, ${fixes.length} open fixes${resolved.modifiedCount ? `, ${resolved.modifiedCount} verified fixed` : ""}.`,
    "/app/fixes",
  );
  return { auditId: String(audit._id), score, fixes: fixes.length };
}
