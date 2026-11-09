import "server-only";
import type { Types } from "mongoose";
import { Job, Snapshot, TrackingResult, type ClientDoc, type SnapshotDoc, type TrackingResultDoc } from "./models";
import { daysAgo } from "./utils";

/** Validated categorical order. Colour follows the entity: brand = slot 1, competitors by their list order. */
const SLOTS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
export function entityColors(client: Pick<ClientDoc, "name" | "competitors">) {
  const map: Record<string, string> = { [client.name]: SLOTS[0] };
  client.competitors.slice(0, 7).forEach((c, i) => (map[c.name] = SLOTS[i + 1]));
  return map;
}
export const OTHER_COLOR = "#8E949D";

export async function snapshots(clientId: Types.ObjectId | string, days = 90) {
  return Snapshot.find({ clientId, date: { $gte: daysAgo(days) } }).sort({ date: 1 }).lean<SnapshotDoc[]>();
}

/** Latest snapshot and the one ~7 days before it, for week-over-week deltas. */
export function latestAndPrior(snaps: SnapshotDoc[]) {
  const latest = snaps.at(-1) ?? null;
  if (!latest) return { latest: null, prior: null };
  const target = new Date(`${latest.date}T00:00:00Z`);
  target.setUTCDate(target.getUTCDate() - 7);
  const t = target.toISOString().slice(0, 10);
  const prior = [...snaps].reverse().find((s) => s.date <= t) ?? (snaps.length > 1 ? snaps[0] : null);
  return { latest, prior };
}

/** Rows from the most recent tracking run. */
export async function latestRun(clientId: Types.ObjectId | string) {
  const last = await TrackingResult.findOne({ clientId }).sort({ createdAt: -1 }).select("runId date").lean<{ runId: string; date: string }>();
  if (!last) return { date: null as string | null, rows: [] as TrackingResultDoc[] };
  const rows = await TrackingResult.find({ clientId, runId: last.runId }).lean<TrackingResultDoc[]>();
  return { date: last.date, rows };
}

export async function pendingJobs(clientId: string) {
  return Job.find({ "payload.clientId": clientId, status: { $in: ["queued", "running"] } }).select("type status").lean();
}
