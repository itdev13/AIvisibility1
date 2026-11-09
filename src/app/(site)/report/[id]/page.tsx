import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckForm, ReportProgress, UnlockForm } from "@/components/forms";
import { BarList } from "@/components/charts";
import { Badge, ButtonLink, Card, CardHeader, EngineChip, ScoreRing, StatusIcon } from "@/components/ui";
import { db } from "@/lib/db";
import { ENGINE_META, type EngineId } from "@/lib/engines/types";
import { scoreBand } from "@/lib/analysis/metrics";
import { FreeCheck, type FreeCheckDoc } from "@/lib/models";
import { cn } from "@/lib/utils";
import { SHOW_PRICING } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI visibility report", robots: { index: false } };

function Cell({ r }: { r?: FreeCheckDoc["results"][number] }) {
  if (!r) return <span className="text-ink-300">·</span>;
  return r.mentioned ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#E6F0FB] px-1.5 py-0.5 text-[11.5px] font-semibold text-[#184F95]">
      ✓ {r.position ? `#${r.position}` : ""}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-md bg-ink-100 px-1.5 py-0.5 text-[11.5px] font-medium text-ink-500">Not named</span>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) notFound();
  await db();
  const c = await FreeCheck.findById(id).lean<FreeCheckDoc>();
  if (!c) notFound();

  if (c.status === "queued" || c.status === "running") {
    return (
      <div className="mx-auto max-w-xl px-5 py-20">
        <div className="eyebrow">Running your check</div>
        <h1 className="display mt-3 text-[40px] text-ink-950">{c.domain}</h1>
        <p className="mt-2 text-[14.5px] text-ink-600">This takes about two minutes. We're asking AI engines live, so keep this tab open.</p>
        <Card className="mt-8 p-6">
          <ReportProgress id={id} initial={{ step: c.step, progress: c.progress }} />
        </Card>
      </div>
    );
  }

  if (c.status === "failed") {
    return (
      <div className="mx-auto max-w-xl px-5 py-20 text-center">
        <h1 className="display text-[40px] text-ink-950">We couldn't finish the check</h1>
        <p className="mt-3 text-[14.5px] text-ink-600">{c.error || "Something went wrong."}</p>
        <div className="mt-8 text-left">
          <CheckForm />
        </div>
      </div>
    );
  }

  const band = scoreBand(c.score);
  const engines = c.engines as EngineId[];
  const answers = c.results.length;
  const named = c.results.filter((r) => r.mentioned).length;
  const byQ = c.questions.map((q) => ({ q, rs: engines.map((e) => c.results.find((r) => r.question === q && r.engine === e)) }));
  const shown = c.unlocked ? byQ : byQ.slice(0, 3);
  const failing = c.checks.filter((x) => x.status !== "pass");
  // Low visibility needs content + monthly fixes (Growth); already-visible brands win more with off-site (Scale).
  const recommend = c.score >= 60 ? "scale" : "growth";

  return (
    <div className="mx-auto max-w-5xl px-5 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">AI visibility report</div>
          <h1 className="display mt-2 text-[40px] text-ink-950">{c.brand || c.domain}</h1>
          <p className="mt-1 text-[14px] text-ink-500">
            {c.domain}
            {c.category && ` · ${c.category}`}
            {c.location && ` · ${c.location}`}
          </p>
        </div>
        <span className="text-[12px] text-ink-400">Checked {new Date(c.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
      </div>

      {/* Headline */}
      <Card className="mt-8 overflow-hidden">
        <div className="grid gap-px bg-ink-150 md:grid-cols-[240px_1fr]">
          <div className="flex flex-col items-center justify-center bg-white p-8">
            <ScoreRing score={c.score} size={156} />
            <Badge tone={band.tone} className="mt-4">{band.label}</Badge>
          </div>
          <div className="bg-white p-7">
            <p className="display text-[30px] text-ink-950 sm:text-[34px]">
              AI named {c.brand || "you"} in <span className="tnum">{named}</span> of <span className="tnum">{answers}</span> answers.
            </p>
            <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-ink-600">
              We asked {c.questions.length} questions your buyers might ask across {engines.map((e) => ENGINE_META[e]?.label).join(", ")}.
              {c.rivals[0] && (
                <>
                  {" "}The business AI recommended most often was <b className="text-ink-900">{c.rivals[0].name}</b> ({c.rivals[0].count} mentions).
                </>
              )}
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              {engines.map((e) => {
                const rs = c.results.filter((r) => r.engine === e);
                const v = rs.length ? rs.filter((r) => r.mentioned).length / rs.length : 0;
                return (
                  <div key={e}>
                    <EngineChip id={e} />
                    <div className="display tnum mt-2 text-[32px] leading-none text-ink-950">{Math.round(v * 100)}%</div>
                    <div className="text-[12px] text-ink-500">of answers name you</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Questions */}
      <Card className="mt-6">
        <CardHeader title="Question by question" subtitle="✓ means you were named. #n is your position in the answer." />
        <div className="relative mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-[13.5px]">
            <thead>
              <tr className="border-y border-ink-150 text-left">
                <th className="px-5 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">Buyer question</th>
                {engines.map((e) => (
                  <th key={e} className="px-3 py-2.5"><EngineChip id={e} withLabel={false} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map(({ q, rs }) => (
                <tr key={q} className="border-b border-ink-100">
                  <td className="px-5 py-3 text-ink-800">{q}</td>
                  {rs.map((r, i) => (
                    <td key={i} className="px-3 py-3"><Cell r={r} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!c.unlocked && (
          <div className="relative">
            <div className="pointer-events-none select-none blur-[5px]" aria-hidden>
              {byQ.slice(3, 6).map(({ q }) => (
                <div key={q} className="border-b border-ink-100 px-5 py-3 text-[13.5px] text-ink-700">{q}</div>
              ))}
            </div>
            <div className="border-t border-ink-150 bg-gradient-to-b from-white/60 to-white p-6">
              <div className="mx-auto max-w-2xl">
                <div className="text-[16px] font-semibold text-ink-950">See the full report</div>
                <p className="mb-4 mt-1 text-[13.5px] text-ink-600">
                  All {c.questions.length} questions, what each AI actually said, who it recommends instead of you, and your AI-readiness audit with fixes.
                </p>
                <UnlockForm checkId={id} />
              </div>
            </div>
          </div>
        )}
      </Card>

      {c.unlocked && (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <Card>
              <CardHeader title="Who AI recommends instead" subtitle="Businesses named across all answers" />
              <div className="p-5">
                {c.rivals.length ? (
                  <BarList
                    format="int"
                    rows={c.rivals.slice(0, 8).map((r) => ({ name: r.name, value: r.count, color: "#eb6834" }))}
                  />
                ) : (
                  <p className="text-[13.5px] text-ink-500">No other businesses were consistently named.</p>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader
                title="AI-readiness audit"
                subtitle={`${c.readiness}/100 · ${failing.length} things to fix`}
              />
              <ul className="mt-3 divide-y divide-ink-100">
                {c.checks.map((x) => (
                  <li key={x.id} className="flex gap-3 px-5 py-3">
                    <StatusIcon status={x.status} />
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium text-ink-900">{x.title}</div>
                      <div className="text-[12.5px] leading-relaxed text-ink-500">{x.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader title="What the AI engines said" subtitle="Excerpts from each answer" />
            <div className="mt-3 divide-y divide-ink-100">
              {c.results.slice(0, 18).map((r, i) => (
                <details key={i} className="group px-5 py-3.5">
                  <summary className="flex cursor-pointer list-none items-center gap-3 text-[13.5px]">
                    <EngineChip id={r.engine} withLabel={false} />
                    <span className="flex-1 truncate text-ink-800">{r.question}</span>
                    <Cell r={r} />
                  </summary>
                  <p className="mt-3 whitespace-pre-line rounded-xl bg-ink-50 p-4 text-[13px] leading-relaxed text-ink-700">{r.excerpt || "No answer text."}</p>
                </details>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* CTA */}
      <div className={cn("noise mt-10 overflow-hidden rounded-[24px] bg-ink-950 p-8 text-white sm:p-12")}>
        <div className="grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="display text-[38px] sm:text-[46px]">
              We can fix this. <em className="text-lime">Starting this week.</em>
            </h2>
            <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-white/60">
              {SHOW_PRICING
              ? "Mentiq tracks these questions every day, ships the fixes above, and publishes content that gets you named. Your dashboard is live within the hour."
              : "We check these questions every day, fix the problems above and write the pages that get you named. You run your business; we handle AI."}
            </p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            {SHOW_PRICING ? (
              <>
                <ButtonLink href={`/signup?plan=${recommend}`} variant="lime" size="lg">Start with {recommend === "scale" ? "Scale" : "Growth"}</ButtonLink>
                <ButtonLink href="/pricing" variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white">Compare plans</ButtonLink>
              </>
            ) : (
              <>
                <ButtonLink href="/#contact" variant="lime" size="lg">Talk to us about fixing this</ButtonLink>
                <span className="text-[13px] text-white/55">Free, no obligation. We reply by email.</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
