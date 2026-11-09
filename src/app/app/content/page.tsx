import Link from "next/link";
import { Badge, Card, Empty, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { CLIENT_STATUS, TYPE_LABEL } from "@/lib/content-labels";
import { Content, type ContentDoc, type ContentStatus } from "@/lib/models";
import { getPlan } from "@/lib/plans";
import { cn, monthKey, relTime } from "@/lib/utils";

const TABS: { id: string; label: string; statuses: ContentStatus[] }[] = [
  { id: "all", label: "All", statuses: ["planned", "drafting", "review", "client_review", "approved", "published"] },
  { id: "client_review", label: "Needs approval", statuses: ["client_review"] },
  { id: "progress", label: "In progress", statuses: ["planned", "drafting", "review"] },
  { id: "approved", label: "Approved", statuses: ["approved"] },
  { id: "published", label: "Published", statuses: ["published"] },
];

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ status?: string; month?: string }> }) {
  const sp = await searchParams;
  const { client } = await requireClient();
  const plan = getPlan(client.plan)!;
  const tab = TABS.find((t) => t.id === sp.status) ?? TABS[0];
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : monthKey();
  const [items, months] = await Promise.all([
    Content.find({ clientId: client._id, month, status: { $in: tab.statuses } }).sort({ updatedAt: -1 }).lean<ContentDoc[]>(),
    Content.distinct("month", { clientId: client._id }) as Promise<string[]>,
  ]);
  const monthList = [...new Set([monthKey(), ...months])].sort().reverse();

  return (
    <>
      <PageHeader
        title="Content"
        subtitle={`Every piece is drafted by our platform, edited by a person, and approved by you before it goes live. ${plan.name} includes ${plan.posts} articles${plan.moneyPages ? `, ${plan.moneyPages} money pages` : ""}${plan.pagesImproved ? ` and ${plan.pagesImproved} page improvements` : ""} a month.`}
        actions={
          <form className="flex items-center gap-2">
            {sp.status && <input type="hidden" name="status" value={sp.status} />}
            <select name="month" defaultValue={month} className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-[13px]">
              {monthList.map((m) => (
                <option key={m} value={m}>{new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</option>
              ))}
            </select>
            <button className="h-8 rounded-lg bg-ink-900 px-3 text-[13px] font-medium text-white">Go</button>
          </form>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/app/content?status=${t.id}&month=${month}`}
            className={cn("rounded-lg px-3 py-1.5 text-[13px] transition", tab.id === t.id ? "bg-ink-900 text-white" : "bg-white text-ink-600 ring-1 ring-ink-200 hover:text-ink-950")}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <Card>
        {items.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th className="text-right">Words</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={String(c._id)} className="group">
                  <Td className="max-w-[460px]">
                    <Link href={`/app/content/${c._id}`} className="block font-medium text-ink-950 group-hover:underline">{c.title}</Link>
                    {c.targetQuestion && <div className="mt-0.5 truncate text-[12px] text-ink-500">Answers: {c.targetQuestion}</div>}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-600">{TYPE_LABEL[c.type]}</Td>
                  <Td><Badge tone={CLIENT_STATUS[c.status].tone} dot>{CLIENT_STATUS[c.status].label}</Badge></Td>
                  <Td className="tnum text-right text-ink-600">{c.wordCount ? c.wordCount.toLocaleString() : "—"}</Td>
                  <Td className="whitespace-nowrap text-ink-500">{relTime(c.updatedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty title="Nothing here yet">This month's plan is created automatically and drafts start appearing within a day.</Empty>
        )}
      </Card>
    </>
  );
}
