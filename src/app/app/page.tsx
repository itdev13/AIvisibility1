import Link from "next/link";
import { runTrackingNow } from "@/app/actions/workspace";
import { BarList, LineChart } from "@/components/charts";
import { SubmitButton } from "@/components/forms";
import { Badge, Card, EngineChip, Meter, Notice, PageHeader, ScoreRing, Stat } from "@/components/ui";
import { ENGINE_META, type EngineId } from "@/lib/engines/types";
import { requireClient } from "@/lib/auth";
import { entityColors, latestAndPrior, pendingJobs, snapshots } from "@/lib/dashboard";
import { scoreBand } from "@/lib/analysis/metrics";
import { Activity, Content, Fix, type ActivityDoc } from "@/lib/models";
import { getPlan } from "@/lib/plans";
import { monthKey, pct, relTime } from "@/lib/utils";

const rateDelta = (now: number, before?: number | null) =>
  before == null ? null : { value: now - before, label: `${Math.round(Math.abs(now - before) * 100)} pts` };


export default async function Overview({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const { client } = await requireClient();
  const plan = getPlan(client.plan)!;
  const cid = client._id;
  const month = monthKey();

  const [snaps, activity, contentAgg, fixAgg, jobs] = await Promise.all([
    snapshots(cid, 90),
    Activity.find({ clientId: cid }).sort({ createdAt: -1 }).limit(12).lean<ActivityDoc[]>(),
    Content.aggregate<{ _id: { type: string; status: string }; n: number }>([{ $match: { clientId: cid, month } }, { $group: { _id: { type: "$type", status: "$status" }, n: { $sum: 1 } } }]),
    Fix.aggregate<{ _id: string; n: number }>([{ $match: { clientId: cid } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    pendingJobs(String(cid)),
  ]);
  const allSnaps = snaps;
  const scored = allSnaps.filter((s) => s.answers > 0);
  const newest = allSnaps.at(-1) ?? null;
  const lastCheckEmpty = Boolean(newest && newest.answers === 0);
  const { latest, prior } = latestAndPrior(scored);
  const colors = entityColors(client);
  const delivered = (type: string) => contentAgg.filter((c) => c._id.type === type && ["client_review", "approved", "published"].includes(c._id.status)).reduce((s, c) => s + c.n, 0);
  const fixes = Object.fromEntries(fixAgg.map((f) => [f._id, f.n]));
  const awaiting = contentAgg.filter((c) => c._id.status === "client_review").reduce((s, c) => s + c.n, 0);

  const header = (
    <PageHeader
      eyebrow={latest ? `Edition of ${new Date(`${latest.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })} · checked ${relTime(client.lastTrackedAt)}` : newest ? "Waiting for answers" : "Setting up"}
      title="The Briefing"
      subtitle={`How often AI recommends ${client.name} when buyers ask about ${client.category || "your category"}.`}
      actions={
        <form action={runTrackingNow}>
          <SubmitButton variant="outline" size="sm" pendingText="Queued">Run check now</SubmitButton>
        </form>
      }
    />
  );

  if (!latest && newest) {
    return (
      <>
        {header}
        <section className="grid gap-8 border-b border-ink-950 pb-10 lg:grid-cols-[1fr_300px] lg:gap-12">
          <div>
            <div className="eyebrow">Lead story</div>
            <h2 className="display mt-4 text-[38px] text-ink-950 sm:text-[52px]">
              No AI engine answered your <span className="hl">first check.</span>
            </h2>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-700">
              We asked your buyer questions, but none of the AI engines in your plan returned an answer, so there's nothing to score yet. This is not a score of zero. Your results will appear here after the next check that gets answers.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/app/questions" className="inline-flex h-10 items-center rounded-[5px] border border-ink-950 bg-ink-950 px-4 text-[14px] font-medium text-white hover:bg-ink-800">See which engines failed</Link>
              <form action={runTrackingNow}>
                <SubmitButton variant="outline" pendingText="Queued">Run the check again</SubmitButton>
              </form>
            </div>
          </div>
          <aside className="flex flex-col justify-center gap-3 border-ink-950 lg:border-l lg:pl-10">
            <div className="eyebrow">Latest check</div>
            <div className="display text-[44px] leading-none text-ink-950">{new Date(`${newest.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</div>
            <p className="text-[14px] leading-relaxed text-ink-600">0 answers received. Usually an AI account is out of credit or over its quota.</p>
          </aside>
        </section>
      </>
    );
  }

  if (!latest) {
    const steps = [
      ["Writing your buyer questions", "questions.fill"],
      ["Auditing your site", "audit.client"],
      ["Asking the AI engines", "track.client"],
      ["Building your 90-day roadmap", "roadmap.generate"],
    ];
    const running = jobs.length > 0;
    return (
      <>
        {header}
        <Card className="p-8">
          <div className="max-w-xl">
            <Badge tone="info" dot>{running ? "In progress" : "Waiting"}</Badge>
            <h2 className="display mt-4 text-[34px] text-ink-950">{welcome ? `Welcome to Mentiq, ${client.name}.` : "Your workspace is being set up."}</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-600">
              We're putting {plan.questions} buyer questions to {plan.engines.length} AI engines, crawling your site and drafting your roadmap. Most dashboards are live within the hour. This page updates on refresh.
            </p>
            <ol className="mt-6 space-y-3">
              {steps.map(([label]) => (
                <li key={label} className="flex items-center gap-3 text-[14px] text-ink-700">
                  <span className="h-2 w-2 rounded-full bg-ink-900 animate-pulse-dot" />
                  {label}
                </li>
              ))}
            </ol>
            {!running && <Notice tone="warn" className="mt-6">No setup jobs are running. Make sure the worker is running (<code>npm run worker</code>).</Notice>}
          </div>
        </Card>
      </>
    );
  }

  const band = scoreBand(latest.score);
  // AI answers vary day to day; past two weeks of data, show a 7-day rolling average so the trend is readable.
  const smooth = scored.length > 14;
  const series = (get: (s: (typeof snaps)[number]) => number) =>
    scored.map((s, i) => {
      const win = smooth ? scored.slice(Math.max(0, i - 6), i + 1) : [s];
      return { x: s.date, y: (win.reduce((a, w) => a + get(w), 0) / win.length) * 100 };
    });
  const trendSeries = [
    { name: client.name, color: colors[client.name], emphasis: true, points: series((s) => s.visibility) },
    ...client.competitors.slice(0, plan.competitors).map((c) => ({
      name: c.name,
      color: colors[c.name] ?? "#8E949D",
      points: series((s) => s.competitors.find((x) => x.name === c.name)?.visibility ?? 0),
    })),
  ];
  const sov = [
    { name: client.name, value: latest.shareOfVoice, color: colors[client.name], highlight: true },
    ...latest.competitors.map((c) => ({ name: c.name, value: c.shareOfVoice, color: colors[c.name] ?? "#8E949D" })),
  ].sort((a, b) => b.value - a.value);
  const engines = Object.entries(latest.byEngine ?? {}).sort((a, b) => b[1].visibility - a[1].visibility);

  // Front-page copy, written from the numbers.
  const visPts = prior ? Math.round((latest.visibility - prior.visibility) * 100) : null;
  const leader = [...latest.competitors].sort((a, b) => b.visibility - a.visibility)[0];
  const best = engines[0];
  const worst = engines.length > 1 ? engines[engines.length - 1] : null;
  const engineLabel = (id: string) => ENGINE_META[id as EngineId]?.label ?? id;
  const story: string[] = [];
  if (!client.competitors.length) story.push("Add your competitors in Settings to see how you compare.");
  else if (leader && leader.visibility > latest.visibility) story.push(`${leader.name} is named most often, in ${pct(leader.visibility)} of answers.`);
  else if (latest.visibility > 0) story.push("You're named more often than any competitor you track.");
  else story.push("None of the competitors you track were named either.");
  if (best && best[1].visibility > 0) {
    story.push(
      worst && worst[0] !== best[0]
        ? `You're strongest on ${engineLabel(best[0])} (${pct(best[1].visibility)}) and weakest on ${engineLabel(worst[0])} (${pct(worst[1].visibility)}).`
        : `You're strongest on ${engineLabel(best[0])} (${pct(best[1].visibility)}).`,
    );
  }
  if (latest.avgPosition) story.push(`When you're named, you're usually #${latest.avgPosition.toFixed(1)} in the list.`);
  if (latest.visibility === 0) story.push("That's normal at the start. The content and fixes in your plan are how this number moves.");

  return (
    <>
      {header}
      {awaiting > 0 && (
        <Notice tone="info" className="mb-6 flex items-center justify-between gap-3">
          <span>
            <b>{awaiting}</b> piece{awaiting > 1 ? "s" : ""} of content {awaiting > 1 ? "are" : "is"} waiting for your approval.
          </span>
          <Link href="/app/content?status=client_review" className="font-semibold underline underline-offset-2">Review now →</Link>
        </Notice>
      )}

      {lastCheckEmpty && (
        <Notice tone="warn" className="mb-6">
          Today's check didn't get any answers from the AI engines, so these are your results from {new Date(`${latest.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}.{" "}
          <Link href="/app/questions" className="font-semibold underline underline-offset-2">See which engines failed</Link>
        </Notice>
      )}

      {/* ───── Lead story ───── */}
      <section className="grid gap-8 lg:grid-cols-[1fr_280px] lg:gap-12">
        <div className="min-w-0">
          <div className="eyebrow">Lead story</div>
          <h2 className="display mt-4 text-[38px] text-ink-950 sm:text-[54px]">
            AI named {client.name} in <span className="hl-swipe tnum">{pct(latest.visibility)}</span> of answers
            {visPts ? (
              <em className="text-ink-500">{visPts > 0 ? `, up ${visPts} points this week.` : `, down ${Math.abs(visPts)} points this week.`}</em>
            ) : (
              <em className="text-ink-500">.</em>
            )}
          </h2>
          <p className="mt-5 max-w-3xl text-[17px] leading-relaxed text-ink-700">{story.join(" ")}</p>
        </div>
        <aside className="flex flex-col items-center justify-center border-ink-950 lg:border-l lg:pl-10">
          <ScoreRing score={latest.score} size={150} />
          <Badge tone={band.tone} className="mt-4">{band.label}</Badge>
          <p className="mt-3 text-center text-[12px] leading-relaxed text-ink-500">Named 55% · position 25% · cited 20%</p>
        </aside>
      </section>

      {/* ───── The numbers ───── */}
      <section className="mt-10 grid grid-cols-2 border-y border-ink-950 md:grid-cols-4">
        {[
          { label: "Named in answers", value: pct(latest.visibility), d: rateDelta(latest.visibility, prior?.visibility), sub: `${latest.answers} answers checked` },
          { label: "Share of voice", value: pct(latest.shareOfVoice), d: rateDelta(latest.shareOfVoice, prior?.shareOfVoice), sub: "vs tracked competitors" },
          {
            label: "Average position",
            value: latest.avgPosition ? `#${latest.avgPosition.toFixed(1)}` : "—",
            // Lower position number is better, so improvement = prior − latest.
            d: prior?.avgPosition && latest.avgPosition ? { value: prior.avgPosition - latest.avgPosition, label: Math.abs(prior.avgPosition - latest.avgPosition).toFixed(1) } : null,
            sub: "when you're named",
          },
          { label: "Site cited", value: pct(latest.citationRate), d: rateDelta(latest.citationRate, prior?.citationRate), sub: "answers linking to you" },
        ].map((s, i) => (
          <div key={s.label} className={`py-6 ${i % 2 === 1 ? "border-l border-ink-200 pl-5" : "pr-5"} ${i >= 2 ? "border-t border-ink-200 md:border-t-0" : ""} ${i === 2 ? "md:border-l md:pl-5" : ""} ${i > 0 ? "md:pl-6" : ""}`}>
            <Stat label={s.label} value={s.value} delta={s.d} sub={s.sub} />
          </div>
        ))}
      </section>

      {/* ───── Trend + share of voice ───── */}
      <section className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <ColumnHead kicker={`Last ${scored.length} day${scored.length > 1 ? "s" : ""}${smooth ? " · 7-day average" : ""}`} title="Who AI names, over time" />
          <LineChart series={trendSeries} height={250} yMax={100} format="pct" />
        </div>
        <div>
          <ColumnHead kicker="Of all tracked-brand mentions" title="Share of voice" href="/app/competitors" />
          <BarList rows={sov} />
        </div>
      </section>

      {/* ───── Three columns ───── */}
      <section className="mt-12 grid gap-10 border-t border-ink-950 pt-2 lg:grid-cols-3 lg:gap-0">
        <div className="lg:pr-8">
          <ColumnHead kicker="Latest check" title="By AI engine" />
          <ul className="space-y-3">
            {engines.map(([e, v]) => (
              <li key={e} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
                <EngineChip id={e} />
                <span className="tnum font-mono text-[13px] font-medium text-ink-950">{pct(v.visibility)}</span>
                <Meter value={v.visibility} tone="blue" className="col-span-2 h-[5px]" />
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:border-l lg:border-ink-200 lg:px-8">
          <ColumnHead kicker={new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} title="This month's work" href="/app/content" />
          <div className="space-y-4">
            {[
              ["Articles", delivered("blog"), plan.posts],
              ...(plan.moneyPages ? [["Money pages", delivered("money_page"), plan.moneyPages] as const] : []),
              ...(plan.pagesImproved ? [["Pages improved", delivered("refresh"), plan.pagesImproved] as const] : []),
            ].map(([label, done, total]) => (
              <div key={label as string}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-[14px] text-ink-800">{label}</span>
                  <span className="tnum font-mono text-[13px] text-ink-950">
                    {done}<span className="text-ink-400">/{total}</span>
                  </span>
                </div>
                <Meter value={(done as number) / (total as number)} className="h-[5px]" />
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t border-dashed border-ink-300 pt-4">
              <Link href="/app/fixes" className="text-[14px] text-ink-800 hover:underline">Site fixes</Link>
              <span className="font-mono text-[12.5px] text-ink-600">
                <b className="text-ink-950">{fixes.done ?? 0}</b> done · <b className="text-ink-950">{(fixes.open ?? 0) + (fixes.in_progress ?? 0)}</b> open
              </span>
            </div>
          </div>
        </div>
        <div className="lg:border-l lg:border-ink-200 lg:pl-8">
          <ColumnHead kicker="What we did for you" title="Dispatches" />
          {activity.length ? (
            <ul className="space-y-3.5">
              {activity.slice(0, 7).map((a) => (
                <li key={String(a._id)} className="grid grid-cols-[52px_1fr] gap-3">
                  <span className="pt-0.5 font-mono text-[10.5px] uppercase text-ink-400">{relTime(a.createdAt).replace(/, \d{4}$/, "")}</span>
                  <span className="text-[13.5px] leading-snug text-ink-800">
                    {a.link ? <Link href={a.link} className="hover:underline">{a.message}</Link> : a.message}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-ink-500">Activity appears here as we work.</p>
          )}
        </div>
      </section>

      {/* ───── Roadmap ───── */}
      {client.roadmap?.items?.length > 0 && (
        <section className="mt-14 border-t-[3px] border-double border-ink-950 pt-6">
          <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
            <div>
              <div className="eyebrow">The plan</div>
              <h3 className="display mt-3 text-[36px] text-ink-950">Your 90 days.</h3>
            </div>
            <p className="font-display text-[19px] italic leading-relaxed text-ink-700">{client.roadmap.summary}</p>
          </div>
          <div className="mt-8 grid gap-8 md:grid-cols-3 md:gap-0">
            {[1, 2, 3].map((m) => (
              <div key={m} className={m > 1 ? "md:border-l md:border-ink-200 md:pl-8" : "md:pr-8"}>
                <div className="flex items-baseline gap-3 border-b border-ink-950 pb-2">
                  <span className="display text-[34px] italic leading-none text-ink-300">{["I", "II", "III"][m - 1]}</span>
                  <span className="eyebrow">Month {m}</span>
                </div>
                <ul className="mt-4 space-y-4">
                  {client.roadmap.items.filter((i) => i.month === m).map((i, k) => (
                    <li key={k}>
                      <div className="flex items-start gap-2">
                        <span className={`mt-[3px] font-mono text-[11px] ${i.done ? "text-good" : "text-ink-400"}`}>{i.done ? "✓" : "○"}</span>
                        <div>
                          <div className={`text-[14px] font-medium leading-snug ${i.done ? "text-ink-500 line-through decoration-ink-300" : "text-ink-950"}`}>{i.title}</div>
                          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-400">{i.area} · </span>
                            {i.detail}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** Newspaper column head: kicker, serif title, optional "more" link, rule beneath. */
function ColumnHead({ kicker, title, href }: { kicker: string; title: string; href?: string }) {
  return (
    <div className="mb-5 mt-4 flex items-end justify-between gap-3 border-b border-ink-200 pb-2.5">
      <div>
        <div className="eyebrow">{kicker}</div>
        <h3 className="serif mt-1 text-[22px] leading-tight text-ink-950">{title}</h3>
      </div>
      {href && (
        <Link href={href} className="font-mono text-[11px] uppercase tracking-wider text-ink-500 hover:text-ink-950">
          More →
        </Link>
      )}
    </div>
  );
}
