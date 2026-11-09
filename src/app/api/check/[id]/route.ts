import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { FreeCheck } from "@/lib/models";

export const dynamic = "force-dynamic";

/** Lightweight status for the report page's progress poller. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db();
  const c = await FreeCheck.findById(id).select("status step progress error brand").lean();
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ status: c.status, step: c.step, progress: c.progress, error: c.error, brand: c.brand });
}
