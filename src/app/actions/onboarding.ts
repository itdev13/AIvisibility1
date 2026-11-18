"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { crawlSite } from "@/lib/audit/crawl";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { enqueue } from "@/lib/jobs/queue";
import { Client, User, logActivity } from "@/lib/models";
import { parseCompetitors } from "@/lib/competitors";
import { getPlan, type PlanId } from "@/lib/plans";
import { emails, sendEmail } from "@/lib/services/email";
import { inferProfile, type BusinessProfile } from "@/lib/services/profile";
import { createCheckout, stripeAvailable } from "@/lib/services/stripe";
import { domainOf, normalizeUrl } from "@/lib/utils";
import type { FormState } from "./auth";

async function ensureClient(userId: unknown) {
  const user = await User.findById(userId);
  if (!user) redirect("/login");
  if (user.clientId) {
    const c = await Client.findById(user.clientId);
    if (c) return { user, client: c };
  }
  const client = await Client.create({ name: user.name || user.email.split("@")[0], status: "onboarding" });
  user.clientId = client._id;
  await user.save();
  return { user, client };
}

/** Step 1: pick a plan → Stripe Checkout. Without Stripe keys (local dev) the plan is granted directly. */
export async function choosePlan(fd: FormData) {
  const u = await requireUser();
  const plan = getPlan(String(fd.get("plan")));
  if (!plan) redirect("/pricing");
  await db();
  const { client } = await ensureClient(u._id);
  if (stripeAvailable()) {
    const url = await createCheckout({ plan: plan.id, email: u.email, userId: String(u._id), customerId: client.stripeCustomerId || undefined });
    redirect(url);
  }
  client.plan = plan.id as PlanId;
  await client.save();
  redirect("/onboarding?dev=1");
}

/** Read the site and suggest brand, category, competitors so onboarding is a confirmation, not a form. */
export async function scanSite(website: string): Promise<{ profile?: BusinessProfile; error?: string }> {
  await requireUser();
  try {
    const url = normalizeUrl(website);
    const crawl = await crawlSite(url, 1);
    if (!crawl.home) return { error: "We couldn't load that site. Fill the details in manually." };
    return { profile: await inferProfile(url, crawl.home) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Step 2: confirm the business details → workspace goes live and setup jobs start. */
export async function completeOnboarding(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  await db();
  const { user, client } = await ensureClient(u._id);
  if (!client.plan) return { error: "Choose a plan first." };
  let website: string;
  try {
    website = normalizeUrl(String(fd.get("website") ?? ""));
  } catch (e) {
    return { error: (e as Error).message };
  }
  const name = String(fd.get("name") ?? "").trim();
  const category = String(fd.get("category") ?? "").trim();
  if (!name || !category) return { error: "Brand name and category are required." };

  client.name = name;
  client.website = website;
  client.domain = domainOf(website);
  client.category = category;
  client.description = String(fd.get("description") ?? "").trim();
  client.location = String(fd.get("location") ?? "").trim();
  client.audience = String(fd.get("audience") ?? "").trim();
  client.aliases = String(fd.get("aliases") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  client.competitors = parseCompetitors(String(fd.get("competitors") ?? "")).slice(0, getPlan(client.plan)!.competitors) as any;
  client.onboardedAt = new Date();
  // Paid via Stripe → webhook already set status; dev mode (no Stripe) → active now.
  if (client.status === "onboarding") client.status = stripeAvailable() && !client.stripeSubscriptionId ? "onboarding" : "active";
  await client.save();

  await logActivity(client._id, "account", `Workspace created on the ${getPlan(client.plan)!.name} plan.`);
  await enqueue("client.bootstrap", { clientId: String(client._id) }, { dedupeKey: `bootstrap:${client._id}` });
  await sendEmail(user.email, "Your BayClusterLab workspace is being set up", emails.welcome(user.name || client.name, `${env.appUrl()}/app`));
  redirect("/app?welcome=1");
}
