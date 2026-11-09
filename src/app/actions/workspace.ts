"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClient } from "@/lib/auth";
import { parseCompetitors } from "@/lib/competitors";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";
import { Client, Content, Fix, Opportunity, Question, logActivity, type Intent } from "@/lib/models";
import { getPlan } from "@/lib/plans";
import { googleAuthUrl, googleAvailable } from "@/lib/services/google";
import { billingPortal, stripeAvailable } from "@/lib/services/stripe";
import { domainOf, normalizeUrl } from "@/lib/utils";
import type { FormState } from "./auth";

/** Every mutation is scoped to the viewer's own workspace (or the one an admin is viewing). */
const ctx = async () => {
  await db();
  return requireClient();
};
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/* ───────── Questions ───────── */
export async function addQuestion(fd: FormData) {
  const { client } = await ctx();
  const text = str(fd, "text");
  const plan = getPlan(client.plan)!;
  const active = await Question.countDocuments({ clientId: client._id, active: true });
  if (text && active < plan.questions) await Question.create({ clientId: client._id, text, intent: (["discovery", "comparison", "problem", "local", "brand"].includes(str(fd, "intent")) ? str(fd, "intent") : "discovery") as Intent });
  revalidatePath("/app/questions");
}

export async function toggleQuestion(fd: FormData) {
  const { client } = await ctx();
  const q = await Question.findOne({ _id: str(fd, "id"), clientId: client._id });
  if (!q) return;
  if (!q.active) {
    const plan = getPlan(client.plan)!;
    if ((await Question.countDocuments({ clientId: client._id, active: true })) >= plan.questions) return;
  }
  q.active = !q.active;
  await q.save();
  revalidatePath("/app/questions");
}

export async function deleteQuestion(fd: FormData) {
  const { client } = await ctx();
  await Question.deleteOne({ _id: str(fd, "id"), clientId: client._id });
  revalidatePath("/app/questions");
}

/** Replace every question using the current business profile, then run a fresh check. */
export async function rewriteQuestions() {
  const { client } = await ctx();
  await Question.deleteMany({ clientId: client._id });
  await enqueue("questions.fill", { clientId: String(client._id), thenTrack: true }, { dedupeKey: `qfill:${client._id}` });
  await logActivity(client._id, "tracking", "Buyer questions are being rewritten from your updated profile.");
  revalidatePath("/app/questions");
}

export async function fillQuestionsNow() {
  const { client } = await ctx();
  await enqueue("questions.fill", { clientId: String(client._id) }, { dedupeKey: `qfill:${client._id}` });
  revalidatePath("/app/questions");
}

/** Clients can refresh at most every 6 hours (each run costs real API spend). */
export async function runTrackingNow() {
  const { client, user } = await ctx();
  const recent = client.lastTrackedAt && Date.now() - new Date(client.lastTrackedAt).getTime() < 6 * 3600_000;
  if (recent && user.role !== "admin") return;
  await enqueue("track.client", { clientId: String(client._id) }, { dedupeKey: `track:${client._id}:manual:${user.role === "admin" ? randomUUID() : "x"}` });
  revalidatePath("/app");
}

/* ───────── Competitors ───────── */
export async function saveCompetitors(_: FormState, fd: FormData): Promise<FormState> {
  const { client } = await ctx();
  const plan = getPlan(client.plan)!;
  const list = parseCompetitors(str(fd, "competitors"));
  if (list.length > plan.competitors) return { error: `Your plan tracks up to ${plan.competitors} competitors.` };
  await Client.updateOne({ _id: client._id }, { competitors: list, aliases: str(fd, "aliases").split(",").map((s) => s.trim()).filter(Boolean) });
  revalidatePath("/app/competitors");
  return { ok: "Saved. Changes apply from the next daily check." };
}

/* ───────── Fixes ───────── */
export async function setFixStatus(fd: FormData) {
  const { client } = await ctx();
  const status = str(fd, "status");
  if (!["open", "in_progress", "done", "wont_fix"].includes(status)) return;
  const fix = await Fix.findOneAndUpdate({ _id: str(fd, "id"), clientId: client._id }, { status, doneAt: status === "done" ? new Date() : null }, { returnDocument: "after" });
  if (fix && status === "done") await logActivity(client._id, "fix", `Fixed: ${fix.title}`, "/app/fixes");
  revalidatePath("/app/fixes");
}

export async function runAuditNow() {
  const { client } = await ctx();
  await enqueue("audit.client", { clientId: String(client._id) }, { dedupeKey: `audit:${client._id}:manual` });
  revalidatePath("/app/fixes");
}

/* ───────── Content approvals (client side of the review loop) ───────── */
export async function clientApprove(fd: FormData) {
  const { client } = await ctx();
  const item = await Content.findOneAndUpdate({ _id: str(fd, "id"), clientId: client._id, status: "client_review" }, { status: "approved" }, { returnDocument: "after" });
  if (item) {
    await logActivity(client._id, "content", `Approved “${item.title}”.`, `/app/content/${item._id}`);
    if (client.integrations?.wordpress?.url) await enqueue("content.publish", { contentId: String(item._id) }, { dedupeKey: `pub:${item._id}` });
  }
  revalidatePath("/app/content");
  revalidatePath(`/app/content/${str(fd, "id")}`);
}

export async function clientRequestChanges(fd: FormData) {
  const { client } = await ctx();
  const notes = str(fd, "notes");
  await Content.updateOne({ _id: str(fd, "id"), clientId: client._id, status: "client_review" }, { status: "review", reviewNotes: notes ? `Client: ${notes}` : "Client requested changes" });
  revalidatePath(`/app/content/${str(fd, "id")}`);
}

/* ───────── Off-site ───────── */
export async function setOpportunityStatus(fd: FormData) {
  const { client } = await ctx();
  const status = str(fd, "status");
  if (!["new", "in_progress", "done", "skipped"].includes(status)) return;
  await Opportunity.updateOne({ _id: str(fd, "id"), clientId: client._id }, { status });
  revalidatePath("/app/offsite");
}

export async function findOpportunitiesNow() {
  const { client } = await ctx();
  if (!getPlan(client.plan)?.offsite) return;
  await enqueue("offsite.find", { clientId: String(client._id) }, { dedupeKey: `offsite:${client._id}:manual` });
  revalidatePath("/app/offsite");
}

/* ───────── Integrations ───────── */
export async function connectGoogle() {
  const { client } = await ctx();
  if (!googleAvailable()) return;
  const state = randomUUID();
  (await cookies()).set("mq_gstate", `${state}.${client._id}`, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  redirect(googleAuthUrl(state));
}

export async function saveGoogleSelection(fd: FormData) {
  const { client } = await ctx();
  await Client.updateOne({ _id: client._id }, { "integrations.google.gscSite": str(fd, "gscSite"), "integrations.google.ga4Property": str(fd, "ga4Property") });
  await enqueue("traffic.sync", { clientId: String(client._id) }, { dedupeKey: `traffic:${client._id}:manual` });
  revalidatePath("/app/settings");
  revalidatePath("/app/traffic");
}

export async function disconnectGoogle() {
  const { client } = await ctx();
  await Client.updateOne({ _id: client._id }, { "integrations.google": { refreshToken: "", email: "", gscSite: "", ga4Property: "", connectedAt: null } });
  revalidatePath("/app/settings");
}

export async function saveWordPress(_: FormState, fd: FormData): Promise<FormState> {
  const { client } = await ctx();
  const url = str(fd, "url").replace(/\/$/, "");
  const username = str(fd, "username");
  const appPassword = str(fd, "appPassword");
  if (url && !/^https:\/\//.test(url)) return { error: "Use your site's https:// address." };
  if (url && username && appPassword) {
    // Verify the credentials before saving.
    const r = await fetch(`${url}/wp-json/wp/v2/users/me`, { headers: { authorization: `Basic ${Buffer.from(`${username}:${appPassword}`).toString("base64")}` } }).catch(() => null);
    if (!r?.ok) return { error: "WordPress rejected those details. Check the username and application password." };
  }
  await Client.updateOne({ _id: client._id }, { "integrations.wordpress": { url, username, appPassword } });
  revalidatePath("/app/settings");
  return { ok: url ? "WordPress connected. Approved content will publish automatically." : "WordPress disconnected." };
}

export async function openBillingPortal() {
  const { client } = await ctx();
  if (!stripeAvailable() || !client.stripeCustomerId) redirect("/app/settings?billing=unavailable");
  redirect(await billingPortal(client.stripeCustomerId));
}

/* ───────── Business profile ───────── */
export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const { client } = await ctx();
  let website: string;
  try {
    website = normalizeUrl(str(fd, "website"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  const name = str(fd, "name");
  const category = str(fd, "category");
  if (!name || !category) return { error: "Brand name and what you sell are required." };
  const before = `${client.name}|${client.category}|${client.audience}|${client.location}`;
  const next = { name, website, domain: domainOf(website), category, description: str(fd, "description"), audience: str(fd, "audience"), location: str(fd, "location") };
  await Client.updateOne({ _id: client._id }, next);
  const changedMarket = before !== `${next.name}|${next.category}|${next.audience}|${next.location}`;
  if (changedMarket) await logActivity(client._id, "account", "Business profile updated.");
  revalidatePath("/app", "layout");
  return { ok: changedMarket ? "Saved. New buyer questions and content will use these details." : "Saved." };
}
