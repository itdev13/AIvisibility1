import Link from "next/link";
import { addQuestion, deleteQuestion, fillQuestionsNow, rewriteQuestions, toggleQuestion } from "@/app/actions/workspace";
import { Matrix, type MatrixCell } from "@/components/charts";
import { SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, Empty, EngineChip, Input, Notice, PageHeader, Select } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { latestRun, pendingJobs } from "@/lib/dashboard";
import { ENGINES } from "@/lib/engines";
import { ENGINE_META, type EngineId } from "@/lib/engines/types";
import { Question, type QuestionDoc } from "@/lib/models";
import { getPlan } from "@/lib/plans";
import { cn, pct, shortDate } from "@/lib/utils";

const INTENTS = ["all", "discovery", "comparison", "problem", "local", "brand"] as const;
const INTENT_HELP: Record<string, string> = {
  discovery: "“Best X for Y” — buyers looking for options",
  comparison: "“X vs Y”, alternatives to a competitor",
  problem: "Buyers describing a problem they need solved",
  local: "Near me / in a city",
  brand: "Questions that name you directly",
};

/** Turn a raw engine error into something a person can act on. */
function explain(err: string) {
  if (/credit|quota|insufficient|billing|exceeded/i.test(err)) return "out of API credits or over its quota";
  if (/\b(401|403)\b|api key|unauthori[sz]ed|permission/i.test(err)) return "API key was rejected";
  if (/\b404\b|model/i.test(err)) return "model isn't available";
  if (/abort|timeout|timed out/i.test(err)) return "timed out";
  return "request failed";
}

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ intent?: string }> }) {
  const sp = await searchParams;
  const { client, user } = await requireClient();
  const isStaff = user.role === "admin";
  const plan = getPlan(client.plan)!;
  const intent = INTENTS.find((i) => i === sp.intent) ?? "all";
  const [all, run, jobs] = await Promise.all([
    Question.find({ clientId: client._id }).sort({ createdAt: 1 }).lean<QuestionDoc[]>(),
    latestRun(client._id),
    pendingJobs(String(client._id)),
  ]);
  const active = all.filter((q) => q.active);
  const shownList = all.filter((q) => intent === "all" || q.intent === intent);
  const writing = jobs.some((j) => j.type === "questions.fill");
  const checking = jobs.some((j) => j.type === "track.client" || j.type === "client.bootstrap");

  // Per-engine health for the latest check.
  const engineStatus = (plan.engines as EngineId[]).map((id) => {
    const rows = run.rows.filter((r) => r.engine === id);
    const errors = rows.filter((r) => r.error);
    const valid = rows.filter((r) => !r.error && !r.empty);
    const state: "ok" | "failing" | "partial" | "off" | "idle" = !ENGINES[id].available()
      ? "off"
      : !rows.length
        ? "idle"
        : errors.length === rows.length
          ? "failing"
          : errors.length
            ? "partial"
            : "ok";
    return { id, state, valid, firstError: errors[0]?.error ?? "", named: valid.length ? valid.filter((r) => r.mentioned).length / valid.length : null };
  });
  const broken = engineStatus.filter((e) => e.state === "failing" || e.state === "off");
  const validRows = run.rows.filter((r) => !r.error && !r.empty);
  const namedRate = validRows.length ? validRows.filter((r) => r.mentioned).length / validRows.length : null;
  const matrixEngines = engineStatus.filter((e) => e.valid.length > 0).map((e) => e.id);

  const cell = (qid: string, engine: string): MatrixCell => {
    const rs = run.rows.filter((r) => String(r.questionId) === qid && r.engine === engine);
    if (!rs.length || rs.every((r) => r.error || r.empty)) return { state: "none", detail: rs[0]?.error ? "This engine failed on this question" : rs[0]?.empty ? "No AI answer shown" : "Not checked yet" };
    const named = rs.filter((r) => r.mentioned);
    if (!named.length) {
      const others = rs[0].brandsRanked.slice(0, 3).join(", ");
      return { state: "absent", detail: others ? `Named instead: ${others}` : undefined };
    }
    const pos = Math.min(...named.map((r) => r.position ?? 99));
    return { state: pos <= 1 ? "top" : pos <= 3 ? "named" : "low", position: pos < 99 ? pos : null, detail: rs[0].brandsRanked.slice(0, 4).join(", ") };
  };
  const namedCount = (qid: string) => run.rows.filter((r) => String(r.questionId) === qid && r.mentioned).length;
  const matrixRows = active.filter((q) => intent === "all" || q.intent === intent).sort((a, b) => namedCount(String(a._id)) - namedCount(String(b._id)));

  return (
    <>
      <PageHeader
        eyebrow={run.date ? `Latest check ${shortDate(run.date)}` : undefined}
        title="Buyer questions"
        subtitle="The questions your buyers ask AI. Every day we ask each one on every engine in your plan and record who gets recommended."
      />

      {/* ───── Status ───── */}
      {writing && (
        <Notice tone="info" className="mb-5">
          <b>Writing your new questions.</b> This takes about a minute, then a fresh check starts automatically. Refresh to see progress.
        </Notice>
      )}
      {!writing && checking && <Notice tone="info" className="mb-5"><b>A check is running now.</b> Results appear here as soon as it finishes.</Notice>}
      {broken.length > 0 && !writing && (
        <Notice tone="warn" className="mb-5">
          <b>{broken.map((e) => ENGINE_META[e.id].label).join(", ")}</b> {broken.length === 1 ? "isn't" : "aren't"} returning answers
          {isStaff ? ":" : ", so some results are missing. Our team has been alerted and will re-run the check."}
          {isStaff && (
            <ul className="mt-1.5 list-disc pl-5">
              {broken.map((e) => (
                <li key={e.id}>
                  {ENGINE_META[e.id].label}: {e.state === "off" ? "no API key configured on the server" : explain(e.firstError)}
                </li>
              ))}
            </ul>
          )}
        </Notice>
      )}

      <Card className="mb-5 grid gap-px overflow-hidden bg-ink-150 md:grid-cols-[200px_200px_1fr]">
        <div className="bg-white p-5">
          <div className="text-[12.5px] font-medium text-ink-500">Questions tracked</div>
          <div className="display tnum mt-2 text-[36px] leading-none text-ink-950">
            {active.length}<span className="text-[15px] font-normal text-ink-400"> / {plan.questions}</span>
          </div>
        </div>
        <div className="bg-white p-5">
          <div className="text-[12.5px] font-medium text-ink-500">You're named in</div>
          <div className="display tnum mt-2 text-[36px] leading-none text-ink-950">{namedRate == null ? "—" : pct(namedRate)}</div>
          <div className="text-[12px] text-ink-500">{validRows.length ? `of ${validRows.length} answers` : "no answers yet"}</div>
        </div>
        <div className="bg-white p-5">
          <div className="text-[12.5px] font-medium text-ink-500">Engines</div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {engineStatus.map((e) => (
              <span
                key={e.id}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 text-[12px]",
                  e.state === "ok" ? "border-ink-200 bg-white" : e.state === "failing" || e.state === "off" ? "border-warn/30 bg-warn-soft" : "border-ink-200 bg-ink-50",
                )}
                title={e.state}
              >
                <EngineChip id={e.id} />
                <span className={cn("tnum font-medium", e.state === "ok" || e.state === "partial" ? "text-ink-900" : "text-warn")}>
                  {e.state === "failing" ? "failing" : e.state === "off" ? "off" : e.state === "idle" ? "waiting" : pct(e.named)}
                </span>
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* ───── Intent filter ───── */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {INTENTS.map((i) => (
          <Link
            key={i}
            href={i === "all" ? "/app/questions" : `/app/questions?intent=${i}`}
            title={INTENT_HELP[i]}
            className={cn("rounded-lg px-3 py-1.5 text-[13px] capitalize transition", intent === i ? "bg-ink-900 text-white" : "bg-white text-ink-600 ring-1 ring-ink-200 hover:text-ink-950")}
          >
            {i} <span className="tnum opacity-60">{i === "all" ? active.length : active.filter((q) => q.intent === i).length}</span>
          </Link>
        ))}
      </div>

      {/* ───── Results ───── */}
      <Card>
        <CardHeader title="Where you're named" subtitle="Hover a cell to see who was recommended. Click a question to read the full answers. Questions where you're missing come first." />
        <div className="p-5">
          {matrixEngines.length && matrixRows.length ? (
            <Matrix
              cols={matrixEngines.map((e) => ({ id: e, label: ENGINE_META[e].short }))}
              rows={matrixRows.map((q) => ({ id: String(q._id), label: q.text, href: `/app/questions/${q._id}`, cells: matrixEngines.map((e) => cell(String(q._id), e)) }))}
            />
          ) : (
            <Empty title={writing ? "Writing questions…" : run.rows.length ? "No answers yet" : "No checks yet"}>
              {writing
                ? "Your new questions will appear here once the first check runs."
                : run.rows.length
                  ? "The engines in your plan didn't return answers in the latest check. Results will show here after the next successful check."
                  : "Your first check runs right after setup."}
            </Empty>
          )}
        </div>
      </Card>

      {/* ───── Manage ───── */}
      <Card className="mt-5">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-ink-950">Your questions</h3>
            <p className="mt-0.5 text-[13px] text-ink-500">Paused questions aren't checked and don't count toward your {plan.questions}.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {active.length < plan.questions && !writing && (
              <form action={fillQuestionsNow}>
                <SubmitButton variant="outline" size="sm" pendingText="Queued">✦ Write {plan.questions - active.length} more</SubmitButton>
              </form>
            )}
            {all.length > 0 && !writing && (
              <details className="group relative">
                <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-lg px-3 text-[13px] font-medium text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50">
                  Rewrite all
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-ink-200 bg-white p-4 shadow-lift">
                  <p className="text-[13px] leading-relaxed text-ink-700">
                    Replace all {all.length} questions with new ones written from your current{" "}
                    <Link href="/app/settings#business" className="underline">business profile</Link>, then run a fresh check. Past results for these questions won't show any more.
                  </p>
                  <form action={rewriteQuestions} className="mt-3">
                    <SubmitButton size="sm" className="w-full" pendingText="Rewriting…">Yes, rewrite {all.length} questions</SubmitButton>
                  </form>
                </div>
              </details>
            )}
          </div>
        </div>

        <form action={addQuestion} className="mx-5 mt-4 flex flex-col gap-2 rounded-xl border border-dashed border-ink-200 bg-ink-50/60 p-3 sm:flex-row">
          <Input
            name="text"
            className="flex-1 bg-white"
            placeholder={active.length >= plan.questions ? `You're at your ${plan.questions}-question limit. Pause one to add another.` : "Add a question, as a buyer would ask it. Don't include your brand name."}
            required
            disabled={active.length >= plan.questions}
          />
          <Select name="intent" defaultValue="discovery" className="bg-white capitalize sm:w-40" disabled={active.length >= plan.questions}>
            {INTENTS.slice(1).map((i) => (
              <option key={i} value={i}>{i[0].toUpperCase() + i.slice(1)}</option>
            ))}
          </Select>
          <SubmitButton disabled={active.length >= plan.questions}>Add</SubmitButton>
        </form>

        {shownList.length ? (
          <ul className="mt-3 divide-y divide-ink-100">
            {shownList.map((q) => (
              <li key={String(q._id)} className={cn("group flex items-start gap-3 px-5 py-3", !q.active && "bg-ink-50/60")}>
                <Badge tone="neutral" className="mt-0.5 w-[92px] shrink-0 justify-center capitalize">{q.intent}</Badge>
                <Link href={`/app/questions/${q._id}`} className={cn("min-w-0 flex-1 text-[13.5px] leading-relaxed hover:underline", q.active ? "text-ink-800" : "text-ink-400 line-through decoration-ink-300")}>
                  {q.text}
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <form action={toggleQuestion}>
                    <input type="hidden" name="id" value={String(q._id)} />
                    <button className="rounded-md px-2 py-1 text-[12.5px] text-ink-500 hover:bg-ink-100 hover:text-ink-950">{q.active ? "Pause" : "Resume"}</button>
                  </form>
                  <form action={deleteQuestion}>
                    <input type="hidden" name="id" value={String(q._id)} />
                    <button className="rounded-md px-2 py-1 text-[12.5px] text-ink-400 hover:bg-bad-soft hover:text-bad" aria-label="Delete question">Delete</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title={writing ? "Writing questions…" : "No questions here"}>{writing ? "They'll appear in about a minute." : intent !== "all" ? `No ${intent} questions yet.` : undefined}</Empty>
        )}
      </Card>
    </>
  );
}
