import Link from "next/link";
import { notFound } from "next/navigation";
import { LineChart } from "@/components/charts";
import { Badge, Card, CardHeader, Empty, EngineChip, PageHeader } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { Question, TrackingResult, type QuestionDoc, type TrackingResultDoc } from "@/lib/models";
import { daysAgo, domainOf, escapeRegex, shortDate } from "@/lib/utils";

/** Highlight the brand inside an answer without rendering any HTML from the engine. */
function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const clean = terms.filter((t) => t.length >= 2);
  if (!clean.length) return <>{text}</>;
  const re = new RegExp(`(${clean.map(escapeRegex).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        clean.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="rounded bg-lime px-0.5 font-semibold text-ink-950">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default async function QuestionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) notFound();
  const { client } = await requireClient();
  const q = await Question.findOne({ _id: id, clientId: client._id }).lean<QuestionDoc>();
  if (!q) notFound();
  const rows = await TrackingResult.find({ clientId: client._id, questionId: q._id, date: { $gte: daysAgo(60) } }).sort({ createdAt: -1 }).lean<TrackingResultDoc[]>();
  const latestRunId = rows[0]?.runId;
  const latest = rows.filter((r) => r.runId === latestRunId);

  // Daily: share of engines naming you for this question.
  const byDate = new Map<string, { n: number; named: number }>();
  for (const r of rows) {
    if (r.error || r.empty) continue;
    const d = byDate.get(r.date) ?? { n: 0, named: 0 };
    d.n++;
    if (r.mentioned) d.named++;
    byDate.set(r.date, d);
  }
  const points = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([x, v]) => ({ x, y: (v.named / v.n) * 100 }));
  const terms = [client.name, ...(client.aliases ?? []), client.domain];

  return (
    <>
      <Link href="/app/questions" className="mb-4 inline-block text-[13px] text-ink-500 hover:text-ink-900">← All questions</Link>
      <PageHeader eyebrow={<span className="capitalize">{q.intent} question</span>} title={`“${q.text}”`} />

      <Card>
        <CardHeader title="How often engines name you for this question" subtitle="Last 60 days" />
        <div className="p-5">
          <LineChart series={[{ name: client.name, color: "#2a78d6", emphasis: true, points }]} yMax={100} format="pct" height={180} />
        </div>
      </Card>

      <h2 className="mb-3 mt-8 serif text-[19px] text-ink-950">Latest answers {rows[0] && <span className="font-normal text-ink-500">· {shortDate(rows[0].date)}</span>}</h2>
      {!latest.length ? (
        <Card><Empty title="No answers yet" /></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {latest.map((r) => (
            <Card key={String(r._id)} className="flex flex-col">
              <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
                <EngineChip id={r.engine} />
                {r.error ? (
                  <Badge tone="warn">Engine error</Badge>
                ) : r.empty ? (
                  <Badge tone="neutral">No AI answer shown</Badge>
                ) : r.mentioned ? (
                  <Badge tone="good">Named{r.position ? ` · #${r.position}` : ""}</Badge>
                ) : (
                  <Badge tone="bad">Not named</Badge>
                )}
              </div>
              <div className="max-h-[360px] flex-1 overflow-y-auto whitespace-pre-line px-5 py-4 text-[13px] leading-relaxed text-ink-700">
                {r.error ? <span className="text-ink-500">{r.error}</span> : <Highlighted text={r.answer || "—"} terms={terms} />}
              </div>
              {(r.brandsRanked.length > 0 || r.citations.length > 0) && (
                <div className="space-y-2 border-t border-ink-100 px-5 py-3">
                  {r.brandsRanked.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                      <span className="text-ink-500">Named:</span>
                      {r.brandsRanked.slice(0, 8).map((b, i) => (
                        <span key={i} className="rounded-full bg-ink-100 px-2 py-0.5 text-ink-700">{i + 1}. {b}</span>
                      ))}
                    </div>
                  )}
                  {r.citations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                      <span className="text-ink-500">Sources:</span>
                      {r.citations.slice(0, 8).map((c) => (
                        <a key={c} href={c} target="_blank" rel="noreferrer noopener" className={domainOf(c).endsWith(client.domain) ? "rounded-full bg-lime-soft px-2 py-0.5 font-medium text-lime-deep" : "rounded-full border border-ink-200 px-2 py-0.5 text-ink-600 hover:text-ink-950"}>
                          {domainOf(c)}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
