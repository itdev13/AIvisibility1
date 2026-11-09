import Link from "next/link";
import { setLeadStatus } from "@/app/actions/admin";
import { Card, Empty, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { FreeCheck, Lead, type LeadDoc } from "@/lib/models";
import { cn, relTime } from "@/lib/utils";

const STATUSES = ["new", "contacted", "call_booked", "won", "lost"] as const;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const current = STATUSES.find((s) => s === sp.status);
  const filter = current ? { status: current } : {};
  const [leads, checks24] = await Promise.all([
    Lead.find(filter).sort({ createdAt: -1 }).limit(300).lean<LeadDoc[]>(),
    FreeCheck.countDocuments({ createdAt: { $gt: new Date(Date.now() - 86_400_000) } }),
  ]);

  return (
    <>
      <PageHeader title="Leads" subtitle={`People who unlocked a free report. ${checks24} free checks run in the last 24 hours.`} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {["all", ...STATUSES].map((s) => (
          <Link key={s} href={s === "all" ? "/admin/leads" : `/admin/leads?status=${s}`} className={cn("rounded-lg px-3 py-1.5 text-[13px] capitalize", (sp.status ?? "all") === s ? "bg-ink-900 text-white" : "bg-white text-ink-600 ring-1 ring-ink-200")}>
            {s.replace("_", " ")}
          </Link>
        ))}
      </div>
      <Card>
        {leads.length ? (
          <Table>
            <thead>
              <tr><Th>Lead</Th><Th>Site</Th><Th className="text-right">Score</Th><Th>Status</Th><Th>Notes</Th><Th>When</Th></tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={String(l._id)}>
                  <Td>
                    <div className="font-medium text-ink-900">{l.email}</div>
                    {l.name && <div className="text-[12px] text-ink-500">{l.name}</div>}
                  </Td>
                  <Td>{l.checkId ? <Link href={`/report/${l.checkId}`} target="_blank" className="text-series-1 hover:underline">{l.domain}</Link> : l.domain}</Td>
                  <Td className={cn("tnum text-right font-semibold", (l.score ?? 100) < 40 ? "text-bad" : "")}>{l.score ?? "—"}</Td>
                  <Td colSpan={2}>
                    <form action={setLeadStatus} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={String(l._id)} />
                      <select name="status" defaultValue={l.status} className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-[12.5px] capitalize">
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                      </select>
                      <input name="notes" defaultValue={l.notes} placeholder="Notes" className="h-8 w-48 rounded-lg border border-ink-200 px-2 text-[12.5px]" />
                      <button className="h-8 rounded-lg bg-ink-900 px-2.5 text-[12px] font-medium text-white">Save</button>
                    </form>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-500">{relTime(l.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty title="No leads">Share the free check link (/check) to start collecting leads.</Empty>
        )}
      </Card>
    </>
  );
}
