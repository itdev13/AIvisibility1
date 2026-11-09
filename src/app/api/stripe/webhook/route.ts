import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { Client, User, logActivity } from "@/lib/models";
import { periodEnd, planForPrice, stripe } from "@/lib/services/stripe";

export const dynamic = "force-dynamic";

const statusFor = (s: Stripe.Subscription.Status, onboarded: boolean) =>
  s === "active" || s === "trialing" ? (onboarded ? "active" : "onboarding") : s === "past_due" || s === "unpaid" || s === "incomplete" ? "past_due" : "canceled";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig ?? "", env.stripeWebhookSecret());
  } catch (e) {
    return NextResponse.json({ error: `Bad signature: ${(e as Error).message}` }, { status: 400 });
  }
  await db();

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const user = await User.findById(s.client_reference_id);
      if (!user) break;
      let client = user.clientId ? await Client.findById(user.clientId) : null;
      if (!client) {
        client = await Client.create({ name: user.name || user.email, status: "onboarding" });
        user.clientId = client._id;
        await user.save();
      }
      const sub = s.subscription ? await stripe().subscriptions.retrieve(String(s.subscription)) : null;
      client.plan = (planForPrice(sub?.items.data[0]?.price.id) ?? (s.metadata?.plan as any) ?? client.plan) as any;
      client.stripeCustomerId = String(s.customer ?? "");
      client.stripeSubscriptionId = sub?.id ?? "";
      client.currentPeriodEnd = sub ? periodEnd(sub) : null;
      client.status = client.onboardedAt ? "active" : "onboarding";
      await client.save();
      await logActivity(client._id, "account", `Subscription started on the ${client.plan} plan.`);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const client = await Client.findOne({ $or: [{ stripeSubscriptionId: sub.id }, { stripeCustomerId: String(sub.customer) }] });
      if (!client) break;
      const plan = planForPrice(sub.items.data[0]?.price.id);
      if (plan && plan !== client.plan) await logActivity(client._id, "account", `Plan changed to ${plan}.`);
      if (plan) client.plan = plan;
      client.status = event.type === "customer.subscription.deleted" ? "canceled" : statusFor(sub.status, Boolean(client.onboardedAt));
      client.currentPeriodEnd = periodEnd(sub);
      client.stripeSubscriptionId = sub.id;
      await client.save();
      break;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      await Client.updateOne({ stripeCustomerId: String(inv.customer) }, { status: "past_due" });
      break;
    }
  }
  return NextResponse.json({ received: true });
}
