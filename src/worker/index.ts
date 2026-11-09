/**
 * Background worker: drains the Mongo job queue and schedules the nightly run.
 * Run alongside the web app:  npm run worker   (npm run dev starts both)
 */
import cron from "node-cron";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";
import { processOne } from "@/lib/jobs/handlers";
import { today } from "@/lib/utils";

const CONCURRENCY = Math.max(1, Number(process.env.WORKER_CONCURRENCY ?? 3));
let stopping = false;

async function lane(n: number) {
  while (!stopping) {
    try {
      const worked = await processOne((m) => console.log(`[w${n}] ${m}`));
      if (!worked) await new Promise((r) => setTimeout(r, 3000));
    } catch (e) {
      console.error(`[w${n}] loop error`, e);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function main() {
  await db();
  console.log(`[worker] connected — ${CONCURRENCY} lanes`);

  // 05:00 UTC daily: fan out tracking, audits, content and syncs.
  cron.schedule("0 5 * * *", () => void enqueue("daily", {}, { dedupeKey: `daily:${today()}` }), { timezone: "UTC" });

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => lane(i + 1)));
}

for (const sig of ["SIGINT", "SIGTERM"] as const)
  process.on(sig, () => {
    stopping = true;
    console.log("[worker] stopping after current jobs…");
    setTimeout(() => process.exit(0), 10_000).unref();
  });

main().catch((e) => {
  console.error("[worker] fatal", e);
  process.exit(1);
});
