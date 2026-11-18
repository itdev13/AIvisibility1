import Link from "next/link";
import type { ReactNode } from "react";
import { connectGoogle, disconnectGoogle, openBillingPortal, saveGoogleSelection } from "@/app/actions/workspace";
import { PasswordForm, ProfileForm, SubmitButton, WordPressForm } from "@/components/forms";
import { Badge, ButtonLink, Card, Field, Meter, Notice, PageHeader, Select } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { ENGINE_META } from "@/lib/engines/types";
import { Content, Question } from "@/lib/models";
import { PLAN_LIST, getPlan } from "@/lib/plans";
import { googleAvailable, listGoogleAssets } from "@/lib/services/google";
import { stripeAvailable } from "@/lib/services/stripe";
import { cn, monthKey } from "@/lib/utils";

const GOOGLE_MSG: Record<string, [string, "good" | "bad" | "warn"]> = {
  connected: ["Google connected. Choose your Search Console site and GA4 property below.", "good"],
  denied: ["Google access was cancelled.", "warn"],
  norefresh: ["Google didn't grant offline access. Remove BayClusterLab from your Google account permissions and connect again.", "bad"],
  state: ["That connection link expired. Please try again.", "bad"],
  error: ["Something went wrong connecting Google.", "bad"],
};

/** Settings row: title + explanation on the left, the controls on the right. */
function Section({ id, title, children, aside }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 grid gap-5 border-t border-ink-200/80 py-8 first:border-t-0 first:pt-0 xl:grid-cols-[260px_1fr] xl:gap-10">
      <div>
        <h2 className="serif text-[19px] text-ink-950">{title}</h2>
        {aside && <div className="mt-1.5 text-[13px] leading-relaxed text-ink-500">{aside}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

const GoogleMark = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);
const WordPressMark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="11" fill="#21759B" />
    <path fill="#fff" d="M3.6 12c0 3.3 1.9 6.2 4.7 7.6L4.3 8.6A8.4 8.4 0 0 0 3.6 12zm14.1-.4c0-1-.4-1.8-.7-2.3-.4-.7-.8-1.2-.8-1.9 0-.7.6-1.4 1.3-1.4h.1A8.4 8.4 0 0 0 5 7.5h.5c.9 0 2.2-.1 2.2-.1.4 0 .5.6 0 .7l-.9.1 3 8.9 1.8-5.4-1.3-3.5-.9-.1c-.4 0-.4-.7 0-.7 0 0 1.4.1 2.2.1.9 0 2.2-.1 2.2-.1.4 0 .5.6 0 .7l-.9.1 2.9 8.8.8-2.7c.4-1.1.7-1.9.7-2.6zm-5.5 1.2-2.4 7a8.4 8.4 0 0 0 5.2-.1l-.1-.1-2.7-6.8zm6.9-4.5.1.9c0 .9-.2 1.9-.7 3.1l-2.6 7.5a8.4 8.4 0 0 0 3.2-11.5z" />
  </svg>
);

function Integration({ icon, name, description, status, children }: { icon: ReactNode; name: string; description: string; status: ReactNode; children: ReactNode }) {
  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-200 bg-white shadow-card">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-semibold text-ink-950">{name}</span>
            {status}
          </div>
          <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>
        </div>
      </div>
      <div className="mt-5 sm:pl-14">{children}</div>
    </div>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string; billing?: string }> }) {
  const sp = await searchParams;
  const { client, user, viewingAs } = await requireClient();
  const plan = getPlan(client.plan);
  const g = client.integrations?.google;
  const wp = client.integrations?.wordpress;
  const [assets, activeQuestions, delivered] = await Promise.all([
    g?.refreshToken ? listGoogleAssets(g.refreshToken).catch(() => null) : null,
    Question.countDocuments({ clientId: client._id, active: true }),
    Content.countDocuments({ clientId: client._id, month: monthKey(), status: { $in: ["client_review", "approved", "published"] } }),
  ]);

  const profileFields = [client.name, client.website, client.category, client.description, client.audience];
  const complete = profileFields.filter(Boolean).length + (client.competitors.length ? 1 : 0);
  const completeOf = profileFields.length + 1;
  const quota = plan ? plan.posts + plan.moneyPages + plan.pagesImproved : 0;
  const upgrades = plan ? PLAN_LIST.filter((p) => p.price > plan.price) : [];
  const canManageBilling = stripeAvailable() && Boolean(client.stripeCustomerId);

  return (
    <>
      <PageHeader title="Settings" subtitle="Your business details, connected tools, plan and account." />

      <div className="max-w-6xl">
          {/* ───── Business profile ───── */}
          <Section
            id="business"
            title="Business profile"
            aside={
              <>
                <p>We use this to write the questions your buyers ask AI, and to brief every piece of content.</p>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-[12px]">
                    <span className="font-medium text-ink-700">Profile strength</span>
                    <span className="tnum text-ink-500">{complete}/{completeOf}</span>
                  </div>
                  <Meter value={complete / completeOf} tone={complete === completeOf ? "good" : "warn"} />
                  {complete < completeOf && <p className="mt-2 text-[12px] text-ink-500">A complete profile gives sharper buyer questions.</p>}
                </div>
              </>
            }
          >
            <Card className="p-5 sm:p-6">
              <ProfileForm
                initial={{ name: client.name, website: client.website, category: client.category, description: client.description, audience: client.audience, location: client.location }}
              />
            </Card>
            <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium text-ink-900">
                  Competitors <span className="tnum font-normal text-ink-500">{client.competitors.length} of {plan?.competitors ?? 0}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {client.competitors.length ? (
                    client.competitors.map((c) => (
                      <span key={c.name} className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[12px] text-ink-700">{c.name}</span>
                    ))
                  ) : (
                    <span className="text-[12.5px] text-warn">None yet. Add them so we can measure share of voice.</span>
                  )}
                </div>
              </div>
              <ButtonLink href="/app/competitors" variant="outline" size="sm">Edit competitors</ButtonLink>
            </Card>
          </Section>

          {/* ───── Connections ───── */}
          <Section id="connections" title="Connections" aside="Optional. Each one unlocks more of your dashboard. We only ever request read access, except WordPress, which we use to publish approved content.">
            {sp.google && GOOGLE_MSG[sp.google] && <Notice tone={GOOGLE_MSG[sp.google][1]} className="mb-4">{GOOGLE_MSG[sp.google][0]}</Notice>}
            <Card className="divide-y divide-ink-100">
              <Integration
                icon={<GoogleMark />}
                name="Google Search Console & Analytics"
                description="Shows visitors from ChatGPT, Perplexity and Gemini, plus your Google clicks, on the Traffic page."
                status={g?.refreshToken ? <Badge tone="good" dot>Connected</Badge> : <Badge>Not connected</Badge>}
              >
                {!g?.refreshToken ? (
                  googleAvailable() ? (
                    <form action={connectGoogle}>
                      <SubmitButton variant="outline" size="sm" pendingText="Opening Google…">Connect Google</SubmitButton>
                    </form>
                  ) : (
                    <p className="text-[13px] text-ink-500">Not available on this server yet.</p>
                  )
                ) : (
                  <div className="space-y-4">
                    {g.email && <p className="text-[12.5px] text-ink-500">Connected as <span className="font-medium text-ink-800">{g.email}</span></p>}
                    <form action={saveGoogleSelection} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                      <Field label="Search Console site">
                        <Select name="gscSite" defaultValue={g.gscSite}>
                          <option value="">Choose a site…</option>
                          {assets?.sites.map((s: string) => <option key={s} value={s}>{s}</option>)}
                        </Select>
                      </Field>
                      <Field label="GA4 property">
                        <Select name="ga4Property" defaultValue={g.ga4Property}>
                          <option value="">Choose a property…</option>
                          {assets?.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                      </Field>
                      <SubmitButton>Save & sync</SubmitButton>
                    </form>
                    {!assets && <Notice tone="warn">We couldn't list your Google properties. Try disconnecting and connecting again.</Notice>}
                    <form action={disconnectGoogle}>
                      <button className="text-[12.5px] text-ink-500 hover:text-bad">Disconnect</button>
                    </form>
                  </div>
                )}
              </Integration>

              <Integration
                icon={<WordPressMark />}
                name="WordPress"
                description="Publishes content to your site the moment you approve it. Not on WordPress? We'll send you the finished pages."
                status={wp?.url ? <Badge tone="good" dot>Connected</Badge> : <Badge>Not connected</Badge>}
              >
                {wp?.url ? (
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px]">
                      <span className="text-ink-500">Publishing to</span>
                      <span className="font-medium text-ink-900">{wp.url}</span>
                      <span className="ml-1 text-ink-500 underline underline-offset-2 group-open:hidden">Change</span>
                    </summary>
                    <div className="mt-4">
                      <WordPressForm url={wp.url} username={wp.username} connected={Boolean(wp.appPassword)} />
                      <p className="mt-3 text-[12px] text-ink-500">To disconnect, clear all three fields and save.</p>
                    </div>
                  </details>
                ) : (
                  <details className="group">
                    <summary className="inline-flex cursor-pointer list-none items-center rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-[13px] font-medium text-ink-900 shadow-card hover:bg-ink-50 group-open:hidden">
                      Connect WordPress
                    </summary>
                    <ol className="mb-5 space-y-2 text-[13px] text-ink-600">
                      {[
                        "In WordPress, go to Users → Profile.",
                        "Scroll to Application Passwords, type “BayClusterLab”, and click Add New.",
                        "Copy the password it shows and paste it below with your username.",
                      ].map((t, i) => (
                        <li key={i} className="flex gap-2.5">
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-700">{i + 1}</span>
                          {t}
                        </li>
                      ))}
                    </ol>
                    <WordPressForm url="" username="" connected={false} />
                  </details>
                )}
              </Integration>
            </Card>
          </Section>

          {/* ───── Plan ───── */}
          <Section
            id="plan"
            title="Plan & billing"
            aside={canManageBilling ? "Change plan, update your card, download invoices or cancel, all in the billing portal." : "Billed monthly. No contract, cancel any time."}
          >
            {plan ? (
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="display text-[28px] text-ink-950">{plan.name}</span>
                      <Badge tone={client.status === "active" ? "good" : client.status === "past_due" ? "warn" : "neutral"} className="capitalize">{client.status.replace("_", " ")}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-500">
                      <span className="tnum font-medium text-ink-800">${plan.price.toLocaleString()}</span>/month
                      {client.currentPeriodEnd && ` · renews ${new Date(client.currentPeriodEnd).toLocaleDateString("en-US", { dateStyle: "medium" })}`}
                    </p>
                  </div>
                  {canManageBilling && (
                    <form action={openBillingPortal}>
                      <SubmitButton variant="outline" size="sm" pendingText="Opening…">Manage billing</SubmitButton>
                    </form>
                  )}
                </div>

                <div className="grid gap-px border-t border-ink-100 bg-ink-100 sm:grid-cols-3">
                  {[
                    ["Buyer questions", activeQuestions, plan.questions],
                    ["Competitors", client.competitors.length, plan.competitors],
                    ["Content this month", delivered, quota],
                  ].map(([label, used, max]) => (
                    <div key={label as string} className="bg-white p-5">
                      <div className="text-[12.5px] text-ink-500">{label}</div>
                      <div className="tnum mt-1 text-[18px] font-semibold text-ink-950">
                        {used} <span className="text-[13px] font-normal text-ink-400">/ {max}</span>
                      </div>
                      <Meter value={(used as number) / Math.max(1, max as number)} className="mt-2" />
                    </div>
                  ))}
                </div>

                <div className="border-t border-ink-100 p-5 sm:p-6">
                  <div className="eyebrow mb-3">Included</div>
                  <ul className="grid gap-x-6 gap-y-2 text-[13px] text-ink-700 sm:grid-cols-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-good" aria-hidden>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-500">
                    Tracked on:
                    {plan.engines.map((e) => (
                      <span key={e} className="rounded-full bg-ink-100 px-2 py-0.5 text-ink-700">{ENGINE_META[e].label}</span>
                    ))}
                  </div>
                </div>

                {upgrades.length > 0 && (
                  <div className="border-t border-ink-100 bg-ink-50/70 p-5 sm:p-6">
                    <div className="text-[13.5px] font-medium text-ink-900">Want more?</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {upgrades.map((u) => (
                        <div key={u.id} className={cn("rounded-xl border bg-white p-4", u.highlight ? "border-ink-900" : "border-ink-200")}>
                          <div className="flex items-baseline justify-between">
                            <span className="text-[14px] font-semibold text-ink-950">{u.name}</span>
                            <span className="tnum text-[13px] text-ink-600">${u.price.toLocaleString()}/mo</span>
                          </div>
                          <p className="mt-1 text-[12.5px] text-ink-500">{u.tagline} {u.questions} questions, {u.engines.length} engines, {u.posts} articles a month.</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[12.5px] text-ink-500">
                      {canManageBilling ? "Switch plans from Manage billing above. Changes take effect immediately." : "Reply to any BayClusterLab email or ask your account manager to switch."}{" "}
                      <Link href="/pricing" className="underline underline-offset-2 hover:text-ink-900">Compare plans</Link>
                    </p>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-6 text-[13.5px] text-ink-600">No plan selected. <Link href="/pricing" className="font-medium underline">Choose a plan</Link></Card>
            )}
          </Section>

          {/* ───── Account ───── */}
          <Section id="account" title="Account" aside="How you sign in to BayClusterLab.">
            {viewingAs ? (
              <Card className="p-5 text-[13px] text-ink-500">You're viewing this workspace as BayClusterLab staff. Account settings belong to the client.</Card>
            ) : (
              <Card className="divide-y divide-ink-100">
                <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-ink-900 text-[14px] font-semibold text-white">
                      {(user.name || user.email).slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <div className="text-[14px] font-medium text-ink-950">{user.name || "—"}</div>
                      <div className="text-[13px] text-ink-500">{user.email}</div>
                    </div>
                  </div>
                  {user.googleId ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-1 text-[12.5px] text-ink-700">
                      <GoogleMark /> Signs in with Google
                    </span>
                  ) : (
                    <Badge>Email & password</Badge>
                  )}
                </div>
                {!user.googleId && (
                  <div className="p-5 sm:p-6">
                    <div className="mb-4 text-[14px] font-medium text-ink-950">Change password</div>
                    <PasswordForm />
                  </div>
                )}
              </Card>
            )}
          </Section>
      </div>
    </>
  );
}
