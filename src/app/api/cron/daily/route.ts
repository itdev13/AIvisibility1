import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { enqueue } from "@/lib/jobs/queue";
import { today } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** For external schedulers (Vercel Cron, GitHub Actions…). The worker also schedules this itself. */
export async function GET(req: Request) {
  const secret = env.cronSecret();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const job = await enqueue("daily", {}, { dedupeKey: `daily:${today()}` });
  return NextResponse.json({ ok: true, enqueued: Boolean(job) });
}
