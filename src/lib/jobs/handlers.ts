import { db } from "../db";
import { Client, Content, type ClientDoc, type JobDoc } from "../models";
import { getPlan } from "../plans";
import { monthKey, today } from "../utils";
import { auditClient } from "../services/audit";
import { draftContent, planMonth, publishContent } from "../services/content";
import { runFreeCheck } from "../services/freecheck";
import { syncTraffic } from "../services/google";
import { findOpportunities } from "../services/offsite";
import { fillQuestions } from "../services/questions";
import { generateRoadmap } from "../services/roadmap";
import { trackClient } from "../services/tracking";
import { claimNext, complete, enqueue, fail, type JobType } from "./queue";

const id = (j: JobDoc) => String((j.payload as any)?.clientId ?? "");

const HANDLERS: Record<JobType, (j: JobDoc) => Promise<unknown>> = {
  "freecheck.run": (j) => runFreeCheck(String((j.payload as any).checkId)),
  "questions.fill": async (j) => {
    const r = await fillQuestions(id(j));
    if ((j.payload as any)?.thenTrack) await enqueue("track.client", { clientId: id(j) }, { dedupeKey: `track:${id(j)}:after-rewrite` });
    return r;
  },
  "track.client": (j) => trackClient(id(j)),
  "audit.client": (j) => auditClient(id(j)),
  "roadmap.generate": (j) => generateRoadmap(id(j)),
  "offsite.find": (j) => findOpportunities(id(j)),
  "traffic.sync": (j) => syncTraffic(id(j)),
  "content.draft": (j) => draftContent(String((j.payload as any).contentId)),
  "content.publish": (j) => publishContent(String((j.payload as any).contentId)),

  "content.plan": async (j) => {
    const r = await planMonth(id(j));
    // Draft everything that's planned, spaced out so the queue stays responsive.
    const planned = await Content.find({ clientId: id(j), status: "planned" }).select("_id").lean();
    let i = 0;
    for (const p of planned) await enqueue("content.draft", { contentId: String(p._id) }, { dedupeKey: `draft:${p._id}`, runAt: new Date(Date.now() + i++ * 20_000) });
    return { ...r, drafting: planned.length };
  },

  /** New client: everything needed for a live dashboard within the hour. Each step is independent. */
  "client.bootstrap": async (j) => {
    const cid = id(j);
    const steps: [string, () => Promise<unknown>][] = [
      ["questions", () => fillQuestions(cid)],
      ["audit", () => auditClient(cid)],
      ["tracking", () => trackClient(cid)],
      ["roadmap", () => generateRoadmap(cid)],
    ];
    const out: Record<string, unknown> = {};
    for (const [name, fn] of steps) {
      try {
        out[name] = await fn();
      } catch (e) {
        out[name] = { error: (e as Error).message };
      }
    }
    await enqueue("content.plan", { clientId: cid }, { dedupeKey: `plan:${cid}:${monthKey()}` });
    const client = await Client.findById(cid).lean<ClientDoc>();
    if (getPlan(client?.plan)?.offsite) await enqueue("offsite.find", { clientId: cid }, { dedupeKey: `offsite:${cid}` });
    if (client?.integrations?.google?.refreshToken) await enqueue("traffic.sync", { clientId: cid });
    return out;
  },

  /** Nightly fan-out: tracking daily, audits on plan cadence, content at month start, off-site weekly. */
  daily: async () => {
    await db();
    const clients = await Client.find({ status: "active", plan: { $ne: null } }).lean<ClientDoc[]>();
    const d = today();
    const now = Date.now();
    let n = 0;
    for (const c of clients) {
      const cid = String(c._id);
      const plan = getPlan(c.plan)!;
      const at = (mins: number) => new Date(now + (n++ % 60) * 60_000 + mins * 60_000); // spread load
      await enqueue("track.client", { clientId: cid }, { dedupeKey: `track:${cid}:${d}`, runAt: at(0) });
      if (c.integrations?.google?.refreshToken) await enqueue("traffic.sync", { clientId: cid }, { dedupeKey: `traffic:${cid}:${d}`, runAt: at(5) });
      const sinceAudit = c.lastAuditAt ? (now - new Date(c.lastAuditAt).getTime()) / 86_400_000 : Infinity;
      const auditDue = plan.auditCadence === "weekly" ? sinceAudit >= 7 : plan.auditCadence === "monthly" ? sinceAudit >= 30 : !c.lastAuditAt;
      if (auditDue) await enqueue("audit.client", { clientId: cid }, { dedupeKey: `audit:${cid}:${d}`, runAt: at(10) });
      if (c.lastContentPlanMonth !== monthKey()) await enqueue("content.plan", { clientId: cid }, { dedupeKey: `plan:${cid}:${monthKey()}`, runAt: at(15) });
      if (plan.offsite && new Date().getUTCDay() === 1) await enqueue("offsite.find", { clientId: cid }, { dedupeKey: `offsite:${cid}:${d}`, runAt: at(20) });
    }
    return { clients: clients.length };
  },
};

/** Process one job if any are due. Returns false when the queue is empty. */
export async function processOne(log = console.log): Promise<boolean> {
  const job = await claimNext();
  if (!job) return false;
  const started = Date.now();
  try {
    const handler = HANDLERS[job.type as JobType];
    if (!handler) throw new Error(`Unknown job type ${job.type}`);
    const r = await handler(job);
    await complete(job._id, r);
    log(`[job] ✓ ${job.type} ${String(job._id)} ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (e) {
    await fail(job, e);
    log(`[job] ✗ ${job.type} ${String(job._id)} attempt ${job.attempts}: ${(e as Error).message}`);
  }
  return true;
}
