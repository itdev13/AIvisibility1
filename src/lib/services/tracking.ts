import { randomUUID } from "node:crypto";
import { db } from "../db";
import { env } from "../env";
import { availableEngines, type EngineId } from "../engines";
import { analyzeAnswer, type Entity } from "../analysis/mentions";
import { computeMetrics } from "../analysis/metrics";
import { Client, Question, Snapshot, TrackingResult, logActivity, type ClientDoc } from "../models";
import { getPlan } from "../plans";
import { pool, today } from "../utils";

export const brandEntity = (c: Pick<ClientDoc, "name" | "domain" | "aliases">): Entity => ({ name: c.name, domain: c.domain, aliases: c.aliases ?? [] });
export const competitorEntities = (c: Pick<ClientDoc, "competitors">): Entity[] =>
  (c.competitors ?? []).map((x) => ({ name: x.name, domain: x.domain ?? "", aliases: x.aliases ?? [] }));

/**
 * Ask every active buyer question on every engine in the client's plan,
 * store each answer, then roll the day up into a Snapshot.
 */
export async function trackClient(clientId: string) {
  await db();
  const client = await Client.findById(clientId).lean<ClientDoc>();
  if (!client) throw new Error("Client not found");
  const plan = getPlan(client.plan);
  if (!plan) throw new Error("Client has no plan");

  const engines = availableEngines(plan.engines as EngineId[]);
  if (!engines.length) throw new Error("No tracking engines configured — add API keys in .env");

  const questions = await Question.find({ clientId, active: true }).sort({ createdAt: 1 }).limit(plan.questions).lean();
  if (!questions.length) throw new Error("No active questions");

  const runId = randomUUID();
  const date = today();
  const brand = brandEntity(client);
  const comps = competitorEntities(client).slice(0, plan.competitors);
  const samples = env.trackSamples();

  const tasks = questions.flatMap((q) => engines.flatMap((e) => Array.from({ length: samples }, () => ({ q, e }))));

  let done = 0;
  await pool(tasks, 6, async ({ q, e }) => {
    try {
      const ans = await e.ask(q.text, { location: client.location || undefined });
      const a = ans.empty ? null : await analyzeAnswer(ans, brand, comps);
      await TrackingResult.create({
        clientId,
        questionId: q._id,
        runId,
        date,
        engine: e.id,
        answer: ans.text.slice(0, 12_000),
        empty: Boolean(ans.empty),
        ...(a ?? {}),
      });
    } catch (err) {
      await TrackingResult.create({ clientId, questionId: q._id, runId, date, engine: e.id, error: String((err as Error).message).slice(0, 500) });
    }
    done++;
  });

  const snap = await rollupDay(clientId, date, runId);
  await Client.updateOne({ _id: clientId }, { lastTrackedAt: new Date() });
  await logActivity(
    clientId,
    "tracking",
    `Checked ${questions.length} buyer questions across ${engines.length} AI engines — named in ${Math.round(snap.visibility * 100)}% of answers.`,
    "/app/questions",
  );
  return { runId, answers: done, score: snap.score };
}

/** (Re)compute the day's snapshot from the latest run that day. */
export async function rollupDay(clientId: string, date: string, runId?: string) {
  const client = await Client.findById(clientId).lean<ClientDoc>();
  const rid = runId ?? (await TrackingResult.findOne({ clientId, date }).sort({ createdAt: -1 }).lean())?.runId;
  const rows = await TrackingResult.find({ clientId, date, runId: rid }).lean();
  const names = (client?.competitors ?? []).map((c) => c.name);
  const m = computeMetrics(
    rows.map((r) => ({ engine: r.engine, mentioned: r.mentioned ?? false, position: r.position ?? null, cited: r.cited ?? false, competitorMentions: (r.competitorMentions ?? []) as any, error: r.error ?? "", empty: r.empty ?? false })),
    names,
  );
  await Snapshot.updateOne({ clientId, date }, { $set: { ...m, runId: rid } }, { upsert: true });
  return m;
}
