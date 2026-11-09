import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { availableEngines } from "@/lib/engines";
import { Job } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db();
    const [queued, failed] = await Promise.all([Job.countDocuments({ status: "queued" }), Job.countDocuments({ status: "failed" })]);
    return NextResponse.json({ ok: true, engines: availableEngines().map((e) => e.id), jobs: { queued, failed } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
