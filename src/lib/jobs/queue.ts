import { db } from "../db";
import { Job, type JobDoc } from "../models";

export type JobType =
  | "freecheck.run"
  | "client.bootstrap"
  | "questions.fill"
  | "track.client"
  | "audit.client"
  | "content.plan"
  | "content.draft"
  | "content.publish"
  | "roadmap.generate"
  | "offsite.find"
  | "traffic.sync"
  | "daily";

const STALE_MS = 30 * 60_000;

/** Enqueue a job. With a dedupeKey, a second enqueue while one is queued/running is a no-op. */
export async function enqueue(type: JobType, payload: Record<string, unknown> = {}, o: { runAt?: Date; dedupeKey?: string; maxAttempts?: number } = {}) {
  await db();
  try {
    return await Job.create({ type, payload, runAt: o.runAt ?? new Date(), dedupeKey: o.dedupeKey ?? null, maxAttempts: o.maxAttempts ?? 3 });
  } catch (e: any) {
    if (e?.code === 11000) return null; // duplicate in flight
    throw e;
  }
}

/** Atomically claim the next due job. Also recovers jobs whose worker died mid-run. */
export async function claimNext(): Promise<JobDoc | null> {
  await db();
  await Job.updateMany({ status: "running", lockedAt: { $lt: new Date(Date.now() - STALE_MS) } }, { $set: { status: "queued" } });
  return Job.findOneAndUpdate(
    { status: "queued", runAt: { $lte: new Date() } },
    { $set: { status: "running", lockedAt: new Date() }, $inc: { attempts: 1 } },
    { sort: { runAt: 1 }, returnDocument: "after" },
  ).lean<JobDoc>();
}

export async function complete(id: JobDoc["_id"], result: unknown) {
  await Job.updateOne({ _id: id }, { $set: { status: "done", finishedAt: new Date(), result: result ?? null, lastError: "" } });
}

export async function fail(job: JobDoc, err: unknown) {
  const msg = String((err as Error)?.message ?? err).slice(0, 1000);
  const retry = job.attempts < job.maxAttempts;
  await Job.updateOne(
    { _id: job._id },
    {
      $set: {
        status: retry ? "queued" : "failed",
        lastError: msg,
        runAt: new Date(Date.now() + 60_000 * 2 ** job.attempts),
        ...(retry ? {} : { finishedAt: new Date() }),
      },
    },
  );
}
