import Link from "next/link";
import { runAuditNow, setFixStatus } from "@/app/actions/workspace";
import { SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, Empty, PageHeader, ScoreRing, StatusIcon } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { AI_BOTS } from "@/lib/audit/crawl";
import { Audit, Fix, type AuditDoc, type FixDoc, type FixStatus } from "@/lib/models";
import { getPlan } from "@/lib/plans";
import { cn, relTime } from "@/lib/utils";

const AREA: Record<string, string> = { "ai-access": "AI access", technical: "Technical", schema: "Structured data", content: "Content", offsite: "Off-site" };
const IMPACT_TONE = { high: "bad", medium: "warn", low: "neutral" } as const;
const TABS: { id: string; label: string; statuses: FixStatus[] }[] = [
  { id: "open", label: "To do", statuses: ["open", "in_progress"] },
  { id: "done", label: "Done", statuses: ["done"] },
  { id: "wont_fix", label: "Won't fix", statuses: ["wont_fix"] },
];

export default async function FixesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const { client } = await requireClient();
  const plan = getPlan(client.plan)!;
  const tab = TABS.find((t) => t.id === sp.tab) ?? TABS[0];
  const [audit, fixes, counts] = await Promise.all([
    Audit.findOne({ clientId: client._id }).sort({ createdAt: -1 }).lean<AuditDoc>(),
    Fix.find({ clientId: client._id, status: { $in: tab.statuses } }).lean<FixDoc[]>(),
    Fix.aggregate<{ _id: string; n: number }>([{ $match: { clientId: client._id } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const order = { high: 0, medium: 1, low: 2 };
  fixes.sort((a, b) => order[a.impact] - order[b.impact] || a.title.localeCompare(b.title));
  const n = (s: FixStatus[]) => counts.filter((c) => s.includes(c._id as FixStatus)).reduce((a, c) => a + c.n, 0);

  return (
    <>
      <PageHeader
        title="Site fixes"
        subtitle={
          plan.auditCadence === "once"
            ? "Your AI-readiness audit and the prioritised fix list. Items marked “Your team” need access only you have."
            : `We re-audit ${plan.auditCadence === "weekly" ? "every week" : "every month"} and ship the fixes. The crawler confirms each one.`
        }
        eyebrow={audit ? `Last audit ${relTime(audit.createdAt)}` : undefined}
        actions={
          <form action={runAuditNow}>
            <SubmitButton variant="outline" size="sm" pendingText="Queued">Re-run audit</SubmitButton>
          </form>
        }
      />

      {audit && (
        <div className="mb-5 grid gap-5 lg:grid-cols-[260px_1fr]">
          <Card className="flex flex-col items-center justify-center p-6">
            <ScoreRing score={audit.score} label="AI readiness" size={140} />
            <p className="mt-3 text-[12.5px] text-ink-500">{audit.pagesScanned} pages scanned</p>
          </Card>
          <Card>
            <CardHeader title="Can AI crawlers read your site?" subtitle="From your robots.txt" />
            <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 p-5 sm:grid-cols-2">
              {AI_BOTS.map((b) => {
                const ok = audit.aiBots?.[b.ua] !== false;
                return (
                  <div key={b.ua} className="flex items-center gap-2.5 text-[13px]">
                    <StatusIcon status={ok ? "pass" : "fail"} />
                    <span className="font-mono text-[12px] text-ink-900">{b.ua}</span>
                    <span className="truncate text-ink-500">{b.owner}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link key={t.id} href={`/app/fixes?tab=${t.id}`} className={cn("rounded-lg px-3 py-1.5 text-[13px]", tab.id === t.id ? "bg-ink-900 text-white" : "bg-white text-ink-600 ring-1 ring-ink-200 hover:text-ink-950")}>
            {t.label} <span className="tnum opacity-60">{n(t.statuses)}</span>
          </Link>
        ))}
      </div>

      <Card>
        {fixes.length ? (
          <ul className="divide-y divide-ink-100">
            {fixes.map((f) => (
              <li key={String(f._id)}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-3.5">
                    <Badge tone={IMPACT_TONE[f.impact]} className="w-[68px] justify-center capitalize">{f.impact}</Badge>
                    <span className="min-w-0 flex-1 text-[14px] font-medium text-ink-900">{f.title}</span>
                    <span className="text-[12px] text-ink-500">{AREA[f.area]}</span>
                    <Badge tone={f.owner === "client" ? "info" : "neutral"}>{f.owner === "client" ? "Your team" : "SeoWaveTech"}</Badge>
                    {f.status === "in_progress" && <Badge tone="info" dot>In progress</Badge>}
                    <span className="text-ink-400 transition group-open:rotate-90">›</span>
                  </summary>
                  <div className="px-5 pb-5 pl-[104px]">
                    <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink-600">{f.detail}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(["in_progress", "done", "wont_fix", "open"] as const)
                        .filter((s) => s !== f.status)
                        .map((s) => (
                          <form key={s} action={setFixStatus}>
                            <input type="hidden" name="id" value={String(f._id)} />
                            <input type="hidden" name="status" value={s} />
                            <SubmitButton variant={s === "done" ? "primary" : "outline"} size="sm">
                              {{ in_progress: "Start", done: "Mark done", wont_fix: "Won't fix", open: "Re-open" }[s]}
                            </SubmitButton>
                          </form>
                        ))}
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title={tab.id === "open" ? "No open fixes" : "Nothing here"}>{tab.id === "open" ? "Every check passed in the latest audit." : undefined}</Empty>
        )}
      </Card>
    </>
  );
}
