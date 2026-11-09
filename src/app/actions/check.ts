"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { enqueue } from "@/lib/jobs/queue";
import { FreeCheck, Lead } from "@/lib/models";
import { emails, sendEmail } from "@/lib/services/email";
import { domainOf, normalizeUrl } from "@/lib/utils";
import type { FormState } from "./auth";

const DAILY_LIMIT_PER_IP = 5;

export async function startCheck(_: FormState, fd: FormData): Promise<FormState> {
  let url: string;
  try {
    url = normalizeUrl(String(fd.get("url") ?? ""));
  } catch (e) {
    return { error: (e as Error).message };
  }
  const domain = domainOf(url);
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  await db();

  // Same site checked in the last 24h? Show that report instead of spending again.
  const recent = await FreeCheck.findOne({ domain, status: { $in: ["queued", "running", "done"] }, createdAt: { $gt: new Date(Date.now() - 86_400_000) } }).sort({ createdAt: -1 });
  if (recent) redirect(`/report/${recent._id}`);

  const today = await FreeCheck.countDocuments({ ip, createdAt: { $gt: new Date(Date.now() - 86_400_000) } });
  if (today >= DAILY_LIMIT_PER_IP) return { error: "You've run a few checks today. Book a call and we'll walk you through a full audit." };

  const check = await FreeCheck.create({ url, domain, ip, status: "queued", step: "Queued" });
  await enqueue("freecheck.run", { checkId: String(check._id) }, { maxAttempts: 1 });
  redirect(`/report/${check._id}`);
}

const Unlock = z.object({ checkId: z.string().length(24), email: z.string().trim().toLowerCase().email("Enter a valid work email"), name: z.string().trim().max(80).optional() });

export async function unlockReport(_: FormState, fd: FormData): Promise<FormState> {
  const p = Unlock.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  await db();
  const check = await FreeCheck.findById(p.data.checkId);
  if (!check) return { error: "Report not found" };
  check.email = p.data.email;
  check.unlocked = true;
  await check.save();
  await Lead.updateOne(
    { email: p.data.email, domain: check.domain },
    { $set: { checkId: check._id, score: check.score, name: p.data.name ?? "" }, $setOnInsert: { source: "free-check", status: "new" } },
    { upsert: true },
  );
  await sendEmail(p.data.email, `Your AI visibility report for ${check.domain}`, emails.report(check.domain, check.score, `${env.appUrl()}/report/${check._id}`));
  return { ok: "unlocked" };
}
