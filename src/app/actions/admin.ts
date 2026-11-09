"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { parseCompetitors } from "@/lib/competitors";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { enqueue, type JobType } from "@/lib/jobs/queue";
import { Client, Content, Job, Lead, User, logActivity } from "@/lib/models";
import { getPlan } from "@/lib/plans";
import { VIEW_AS_COOKIE } from "@/lib/session";
import { emails, sendEmail } from "@/lib/services/email";
import { domainOf, normalizeUrl } from "@/lib/utils";
import type { FormState } from "./auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const admin = async () => {
  await db();
  return requireAdmin();
};

/* ───────── View any client's dashboard ───────── */
export async function viewAs(fd: FormData) {
  await admin();
  (await cookies()).set(VIEW_AS_COOKIE, str(fd, "clientId"), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  redirect("/app");
}
export async function exitViewAs() {
  await admin();
  (await cookies()).delete(VIEW_AS_COOKIE);
  redirect("/admin/clients");
}

/* ───────── Sales-led client creation (James closes on a call) ───────── */
export async function createClient(_: FormState, fd: FormData): Promise<FormState> {
  await admin();
  const plan = getPlan(str(fd, "plan"));
  if (!plan) return { error: "Choose a plan" };
  let website: string;
  try {
    website = normalizeUrl(str(fd, "website"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  const contactEmail = str(fd, "contactEmail").toLowerCase();
  const contactName = str(fd, "contactName");
  if (!str(fd, "name") || !str(fd, "category")) return { error: "Brand name and category are required" };
  if (contactEmail && (await User.exists({ email: contactEmail }))) return { error: "A user with that email already exists" };

  const client = await Client.create({
    name: str(fd, "name"),
    website,
    domain: domainOf(website),
    category: str(fd, "category"),
    description: str(fd, "description"),
    location: str(fd, "location"),
    audience: str(fd, "audience"),
    competitors: parseCompetitors(str(fd, "competitors")).slice(0, plan.competitors),
    plan: plan.id,
    status: "active",
    onboardedAt: new Date(),
    notes: str(fd, "notes"),
  });
  if (contactEmail) {
    const temp = randomBytes(6).toString("base64url");
    await User.create({ email: contactEmail, name: contactName, passwordHash: await hashPassword(temp), role: "client", clientId: client._id });
    await sendEmail(contactEmail, "Your Mentiq dashboard is ready", emails.invite(contactName || client.name, `${env.appUrl()}/login`, temp));
  }
  await logActivity(client._id, "account", `Workspace created on the ${plan.name} plan.`);
  await enqueue("client.bootstrap", { clientId: String(client._id) }, { dedupeKey: `bootstrap:${client._id}` });
  redirect(`/admin/clients/${client._id}`);
}

export async function updateClient(fd: FormData) {
  await admin();
  const id = str(fd, "id");
  const set: Record<string, unknown> = {};
  const plan = str(fd, "plan");
  const status = str(fd, "status");
  if (getPlan(plan)) set.plan = plan;
  if (["onboarding", "active", "past_due", "canceled"].includes(status)) set.status = status;
  if (fd.has("notes")) set.notes = str(fd, "notes");
  await Client.updateOne({ _id: id }, set);
  revalidatePath(`/admin/clients/${id}`);
}

const ALLOWED_JOBS: JobType[] = ["track.client", "audit.client", "content.plan", "roadmap.generate", "offsite.find", "traffic.sync", "questions.fill", "client.bootstrap"];
export async function runClientJob(fd: FormData) {
  await admin();
  const type = str(fd, "type") as JobType;
  if (!ALLOWED_JOBS.includes(type)) return;
  await enqueue(type, { clientId: str(fd, "clientId") });
  revalidatePath(`/admin/clients/${str(fd, "clientId")}`);
}

export async function runDailyNow() {
  await admin();
  await enqueue("daily", {});
  revalidatePath("/admin/jobs");
}

export async function retryJob(fd: FormData) {
  await admin();
  await Job.updateOne({ _id: str(fd, "id"), status: "failed" }, { status: "queued", runAt: new Date(), attempts: 0, lastError: "" });
  revalidatePath("/admin/jobs");
}

/* ───────── Editorial review queue ───────── */
export async function saveDraft(fd: FormData) {
  const reviewer = await admin();
  const id = str(fd, "id");
  const body = String(fd.get("body") ?? "");
  await Content.updateOne(
    { _id: id },
    { title: str(fd, "title"), body, metaDescription: str(fd, "metaDescription").slice(0, 160), wordCount: body.split(/\s+/).filter(Boolean).length, reviewedBy: reviewer.email },
  );
  revalidatePath(`/admin/review/${id}`);
}

export async function setContentStatus(fd: FormData) {
  const reviewer = await admin();
  const id = str(fd, "id");
  const status = str(fd, "status");
  const item = await Content.findById(id);
  if (!item) return;
  if (status === "client_review") {
    if (/\[VERIFY:/.test(item.body)) redirect(`/admin/review/${id}?err=verify`);
    item.status = "client_review";
    item.reviewedBy = reviewer.email;
    await item.save();
    const users = await User.find({ clientId: item.clientId, role: "client" }).select("email").lean();
    for (const u of users) await sendEmail(u.email, `Ready for approval: ${item.title}`, emails.review(item.title, `${env.appUrl()}/app/content/${item._id}`));
    await logActivity(item.clientId, "content", `“${item.title}” is ready for your approval.`, `/app/content/${item._id}`);
  } else if (status === "approved" || status === "rejected" || status === "review") {
    item.status = status;
    if (status === "rejected") item.reviewNotes = str(fd, "notes") || item.reviewNotes;
    await item.save();
    if (status === "approved") {
      const client = await Client.findById(item.clientId).lean();
      if (client?.integrations?.wordpress?.url) await enqueue("content.publish", { contentId: id }, { dedupeKey: `pub:${id}` });
    }
  }
  revalidatePath("/admin/review");
  revalidatePath(`/admin/review/${id}`);
}

export async function redraft(fd: FormData) {
  await admin();
  const id = str(fd, "id");
  const notes = str(fd, "notes");
  if (notes) await Content.updateOne({ _id: id }, { brief: `${(await Content.findById(id).select("brief").lean())?.brief ?? ""}\n\nEditor notes for this revision: ${notes}` });
  await enqueue("content.draft", { contentId: id }, { dedupeKey: `draft:${id}` });
  revalidatePath(`/admin/review/${id}`);
}

export async function markPublished(fd: FormData) {
  await admin();
  const id = str(fd, "id");
  const url = str(fd, "url");
  const item = await Content.findByIdAndUpdate(id, { status: "published", publishedUrl: url, publishedAt: new Date() }, { returnDocument: "after" });
  if (item) await logActivity(item.clientId, "content", `Published “${item.title}”.`, url);
  revalidatePath(`/admin/review/${id}`);
}

export async function publishNow(fd: FormData) {
  await admin();
  await enqueue("content.publish", { contentId: str(fd, "id") }, { dedupeKey: `pub:${str(fd, "id")}` });
  revalidatePath(`/admin/review/${str(fd, "id")}`);
}

/* ───────── Leads ───────── */
export async function setLeadStatus(fd: FormData) {
  await admin();
  const status = str(fd, "status");
  if (!["new", "contacted", "call_booked", "won", "lost"].includes(status)) return;
  await Lead.updateOne({ _id: str(fd, "id") }, { status, ...(fd.has("notes") ? { notes: str(fd, "notes") } : {}) });
  revalidatePath("/admin/leads");
}
