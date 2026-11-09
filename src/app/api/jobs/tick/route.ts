import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { processOne } from "@/lib/jobs/handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Serverless fallback for hosts without a long-running worker: call every minute
 * and it drains jobs for up to ~4 minutes. Prefer `npm run worker` on a real server.
 */
export async function GET(req: Request) {
  const secret = env.cronSecret();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const until = Date.now() + 240_000;
  let n = 0;
  while (Date.now() < until && (await processOne())) n++;
  return NextResponse.json({ ok: true, processed: n });
}
