import Link from "next/link";
import { Badge, Card, Empty, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { TYPE_LABEL } from "@/lib/content-labels";
import { Client, Content, type ClientDoc, type ContentDoc } from "@/lib/models";
import { cn, relTime } from "@/lib/utils";

const TABS = [
  { id: "review", label: "Needs editing" },
  { id: "client_review", label: "With client" },
  { id: "approved", label: "Approved, not published" },
  { id: "drafting", label: "Drafting" },
  { id: "planned", label: "Planned" },
] as const;

export default async function ReviewQueue({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.status) ?? TABS[0];
  const [items, counts] = await Promise.all([
    Content.find({ status: tab.id }).sort({ updatedAt: 1 }).limit(200).lean<ContentDoc[]>(),
    Content.aggregate<{ _id: string; n: number }>([{ $match: { status: { $in: TABS.map((t) => t.id) } } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const clients = await Client.find({ _id: { $in: [...new Set(items.map((i) => String(i.clientId)))] } }).select("name").lean<ClientDoc[]>();
  const nameOf = (id: unknown) => clients.find((c) => String(c._id) === String(id))?.name ?? "—";

  return (
    <>
      <PageHeader title="Review queue" subtitle="Every draft gets a human edit before the client sees it. Oldest first. Fill in every [VERIFY] marker before sending." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link key={t.id} href={`/admin/review?status=${t.id}`} className={cn("rounded-lg px-3 py-1.5 text-[13px]", tab.id === t.id ? "bg-ink-900 text-white" : "bg-white text-ink-600 ring-1 ring-ink-200 hover:text-ink-950")}>
            {t.label} <span className="tnum opacity-60">{counts.find((c) => c._id === t.id)?.n ?? 0}</span>
          </Link>
        ))}
      </div>
      <Card>
        {items.length ? (
          <Table>
            <thead>
              <tr><Th>Title</Th><Th>Client</Th><Th>Type</Th><Th className="text-right">Words</Th><Th>Flags</Th><Th>Waiting</Th></tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const flags = (c.body.match(/\[VERIFY:/g) ?? []).length;
                return (
                  <tr key={String(c._id)} className="hover:bg-ink-50/60">
                    <Td className="max-w-[420px]">
                      <Link href={`/admin/review/${c._id}`} className="font-medium text-ink-950 hover:underline">{c.title}</Link>
                      {c.reviewNotes && <div className="mt-0.5 truncate text-[12px] text-warn">{c.reviewNotes}</div>}
                    </Td>
                    <Td>{nameOf(c.clientId)}</Td>
                    <Td className="whitespace-nowrap text-ink-600">{TYPE_LABEL[c.type]}</Td>
                    <Td className="tnum text-right">{c.wordCount || "—"}</Td>
                    <Td>{flags ? <Badge tone="warn">{flags} to verify</Badge> : <span className="text-ink-400">—</span>}</Td>
                    <Td className="whitespace-nowrap text-ink-500">{relTime(c.updatedAt)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Empty title="Queue is clear">Nothing in “{tab.label}”.</Empty>
        )}
      </Card>
    </>
  );
}
