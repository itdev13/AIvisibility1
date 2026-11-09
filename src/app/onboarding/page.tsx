import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { choosePlan } from "@/app/actions/onboarding";
import { logout } from "@/app/actions/auth";
import { OnboardingForm, SubmitButton } from "@/components/forms";
import { Card, Logo, Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatCompetitors } from "@/lib/competitors";
import { db } from "@/lib/db";
import { Client, type ClientDoc } from "@/lib/models";
import { PLAN_LIST, getPlan } from "@/lib/plans";
import { stripeAvailable } from "@/lib/services/stripe";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Set up your workspace", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function Steps({ at }: { at: 1 | 2 }) {
  return (
    <ol className="flex items-center gap-3 text-[12.5px]">
      {["Choose plan", "Your business", "Dashboard"].map((s, i) => (
        <li key={s} className="flex items-center gap-3">
          <span className={cn("flex items-center gap-2", i + 1 <= at ? "text-ink-950 font-medium" : "text-ink-400")}>
            <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[10.5px] font-semibold", i + 1 < at ? "bg-good text-white" : i + 1 === at ? "bg-ink-900 text-white" : "bg-ink-150 text-ink-500")}>
              {i + 1 < at ? "✓" : i + 1}
            </span>
            {s}
          </span>
          {i < 2 && <span className="h-px w-8 bg-ink-200" />}
        </li>
      ))}
    </ol>
  );
}

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ plan?: string; paid?: string; dev?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  if (user.role === "admin") redirect("/admin");
  await db();
  const client = user.clientId ? await Client.findById(user.clientId).lean<ClientDoc>() : null;
  if (client?.onboardedAt) redirect("/app");
  const plan = getPlan(client?.plan);

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between border-b border-ink-200/70 px-6 py-4">
        <Link href="/"><Logo /></Link>
        <form action={logout}>
          <button className="text-[13px] text-ink-500 hover:text-ink-900">Sign out</button>
        </form>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12">
        <Steps at={plan ? 2 : 1} />

        {!plan ? (
          <>
            <h1 className="display mt-8 text-[40px] text-ink-950">Choose your plan</h1>
            <p className="mt-1.5 text-[14.5px] text-ink-500">Month to month. No setup fee. Change or cancel any time.</p>
            {sp.paid && (
              <Notice tone="info" className="mt-6">
                <meta httpEquiv="refresh" content="3" />
                Confirming your payment with Stripe… this page will refresh in a moment.
              </Notice>
            )}
            {!stripeAvailable() && <Notice tone="warn" className="mt-6">Stripe isn't configured, so the plan is activated without payment (development mode).</Notice>}
            <div className="mt-8 grid gap-4">
              {PLAN_LIST.map((p) => {
                const preselected = sp.plan === p.id;
                return (
                  <form key={p.id} action={choosePlan}>
                    <input type="hidden" name="plan" value={p.id} />
                    <Card className={cn("flex flex-wrap items-center justify-between gap-5 p-6 transition", preselected && "ring-2 ring-ink-900")}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[16px] font-semibold text-ink-950">{p.name}</span>
                          {p.highlight && <span className="rounded-full bg-lime px-2 py-0.5 text-[10.5px] font-semibold">Most popular</span>}
                        </div>
                        <p className="mt-1 text-[13.5px] text-ink-500">{p.features.slice(0, 3).join(" · ")}</p>
                      </div>
                      <div className="flex items-center gap-5">
                        <div className="text-right">
                          <span className="display tnum text-[30px]">${p.price.toLocaleString()}</span>
                          <span className="text-[12.5px] text-ink-500">/mo</span>
                        </div>
                        <SubmitButton variant={preselected ? "primary" : "outline"} pendingText="Opening checkout…">
                          {stripeAvailable() ? "Continue to payment" : "Select"}
                        </SubmitButton>
                      </div>
                    </Card>
                  </form>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <h1 className="display mt-8 text-[40px] text-ink-950">Tell us about your business</h1>
            <p className="mt-1.5 text-[14.5px] text-ink-500">
              Paste your website and we'll fill in the rest. This is what we'll use to write your buyer questions and spot competitors.
            </p>
            {sp.paid && <Notice tone="good" className="mt-6">Payment received. You're on the {plan.name} plan.</Notice>}
            <Card className="mt-8 p-6 sm:p-8">
              <OnboardingForm
                defaults={{
                  website: client?.website ?? "",
                  // Self-serve clients start with a placeholder name (the account holder); only keep a real brand set by staff.
                  name: client?.website ? client.name : "",
                  category: client?.category ?? "",
                  description: client?.description ?? "",
                  location: client?.location ?? "",
                  audience: client?.audience ?? "",
                  competitors: formatCompetitors(client?.competitors ?? []),
                  aliases: (client?.aliases ?? []).join(", "),
                  maxCompetitors: plan.competitors,
                }}
              />
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
