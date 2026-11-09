import Link from "next/link";
import { retryJob, runDailyNow } from "@/app/actions/admin";
import { SubmitButton } from "@/components/forms";
import { Badge, Card, Empty, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { Job, type JobDoc } from "@/lib/models";
import { cn, relTime } from "@/lib/utils";

const TONE = { queued: "neutral", running: "info", done: "good", failed: "bad" } as const;

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const STATUSES: JobDoc["status"][] = ["queued", "running", "done", "failed"];
  const status = STATUSES.find((s) => s === sp.status);
  const jobs = await Job.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(150).lean<JobDoc[]>();

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle="Background work processed by the worker (npm run worker). Failed jobs retry automatically with back-off."
        actions={
          <form action={runDailyNow}>
            <SubmitButton variant="outline" size="sm" pendingText="Queued">Run nightly fan-out now</SubmitButton>
          </form>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {["all", "queued", "running", "done", "failed"].map((s) => (
          <Link key={s} href={s === "all" ? "/admin/jobs" : `/admin/jobs?status=${s}`} className={cn("rounded-lg px-3 py-1.5 text-[13px] capitalize", (status ?? "all") === s ? "bg-ink-900 text-white" : "bg-white text-ink-600 ring-1 ring-ink-200")}>
            {s}
          </Link>
        ))}
      </div>
      <Card>
        {jobs.length ? (
          <Table>
            <thead>
              <tr><Th>Type</Th><Th>Status</Th><Th>Payload</Th><Th className="text-right">Attempts</Th><Th>Created</Th><Th>Finished</Th><Th>Error</Th><Th /></tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={String(j._id)}>
                  <Td className="font-mono text-[12px] text-ink-900">{j.type}</Td>
                  <Td><Badge tone={TONE[j.status]} dot={j.status === "running"}>{j.status}</Badge></Td>
                  <Td className="max-w-[200px] truncate font-mono text-[11px] text-ink-500">{JSON.stringify(j.payload)}</Td>
                  <Td className="tnum text-right">{j.attempts}/{j.maxAttempts}</Td>
                  <Td className="whitespace-nowrap text-ink-500">{relTime(j.createdAt)}</Td>
                  <Td className="whitespace-nowrap text-ink-500">{j.finishedAt ? relTime(j.finishedAt) : "—"}</Td>
                  <Td className="max-w-[320px] truncate text-[12px] text-bad" title={j.lastError}>{j.lastError}</Td>
                  <Td>
                    {j.status === "failed" && (
                      <form action={retryJob}>
                        <input type="hidden" name="id" value={String(j._id)} />
                        <button className="text-[12.5px] font-medium text-ink-600 hover:text-ink-950">Retry</button>
                      </form>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty title="No jobs" />
        )}
      </Card>
    </>
  );
}
