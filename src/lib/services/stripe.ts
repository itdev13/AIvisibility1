import Stripe from "stripe";
import { env } from "../env";
import { PLANS, type PlanId } from "../plans";

let client: Stripe | null = null;
export const stripeAvailable = () => Boolean(env.stripeKey());

export function stripe() {
  if (!env.stripeKey()) throw new Error("STRIPE_SECRET_KEY not set");
  client ??= new Stripe(env.stripeKey());
  return client;
}

export function planForPrice(priceId: string | undefined | null): PlanId | null {
  if (!priceId) return null;
  return (Object.keys(PLANS) as PlanId[]).find((p) => env.stripePrice(p) === priceId) ?? null;
}

export async function createCheckout(opts: { plan: PlanId; email: string; userId: string; customerId?: string }) {
  const price = env.stripePrice(opts.plan);
  if (!price) throw new Error(`STRIPE_PRICE_${opts.plan.toUpperCase()} not set`);
  const s = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    ...(opts.customerId ? { customer: opts.customerId } : { customer_email: opts.email }),
    client_reference_id: opts.userId,
    metadata: { plan: opts.plan, userId: opts.userId },
    subscription_data: { metadata: { plan: opts.plan, userId: opts.userId } },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    success_url: `${env.appUrl()}/onboarding?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.appUrl()}/pricing?canceled=1`,
  });
  return s.url!;
}

export async function billingPortal(customerId: string) {
  const s = await stripe().billingPortal.sessions.create({ customer: customerId, return_url: `${env.appUrl()}/app/settings` });
  return s.url;
}

/** current_period_end moved onto subscription items in newer API versions — read either. */
export function periodEnd(sub: Stripe.Subscription): Date | null {
  const raw = (sub as any).current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return raw ? new Date(raw * 1000) : null;
}
