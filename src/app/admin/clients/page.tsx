import Link from "next/link";
import { viewAs } from "@/app/actions/admin";
import { Sparkline } from "@/components/charts";
import { Badge, ButtonLink, Card, Empty, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { Client, Content, Snapshot, type ClientDoc, type SnapshotDoc } from "@/lib/models";
import { PLANS } from "@/lib/plans";
import { daysAgo, money, monthKey, pct, relTime } from "@/lib/utils";

const STATUS_TONE = { active: "good", onboarding: "info", past_due: "warn", canceled: "neutral" } as const;

export default async function ClientsPage() {
  await requireAdmin();
  const clients = await Client.find({}).sort({ createdAt: -1 }).lean<ClientDoc[]>();
  const ids = clients.map((c) => c._id);
  const [snaps, content] = await Promise.all([
    Snapshot.find({ clientId: { $in: ids }, date: { $gte: daysAgo(30) } }).sort({ date: 1 }).select("clientId date score visibility").lean<SnapshotDoc[]>(),
    Content.aggregate<{ _id: unknown; delivered: number }>([
      { $match: { clientId: { $in: ids }, month: monthKey(), status: { $in: ["client_review", "approved", "published"] } } },
      { $group: { _id: "$clientId", delivered: { $sum: 1 } } },
    ]),
  ]);

  return (
    <>
      <PageHeader title="Clients" subtitle={`${clients.length} workspaces`} actions={<ButtonLink href="/admin/clients/new" size="sm">+ New client</ButtonLink>} />
      <Card>
        {clients.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th className="text-right">Score</Th>
                <Th className="text-right">Named</Th>
                <Th>30 days</Th>
                <Th className="text-right">Content this month</Th>
                <Th>Last check</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const s = snaps.filter((x) => String(x.clientId) === String(c._id));
                const last = s.at(-1);
                const plan = c.plan ? PLANS[c.plan] : null;
                const quota = plan ? plan.posts + plan.moneyPages + plan.pagesImproved : 0;
                const delivered = content.find((x) => String(x._id) === String(c._id))?.delivered ?? 0;
                return (
                  <tr key={String(c._id)} className="hover:bg-ink-50/60">
                    <Td>
                      <Link href={`/admin/clients/${c._id}`} className="font-semibold text-ink-950 hover:underline">{c.name}</Link>
                      <div className="text-[12px] text-ink-500">{c.domain || "—"}</div>
                    </Td>
                    <Td>{plan ? <span className="whitespace-nowrap">{plan.name} <span className="text-ink-400">{money(plan.price)}</span></span> : "—"}</Td>
                    <Td><Badge tone={STATUS_TONE[c.status]} className="capitalize">{c.status.replace("_", " ")}</Badge></Td>
                    <Td className="tnum text-right font-semibold">{last?.score ?? "—"}</Td>
                    <Td className="tnum text-right">{last ? pct(last.visibility) : "—"}</Td>
                    <Td><Sparkline values={s.map((x) => x.visibility)} width={80} /></Td>
                    <Td className="tnum text-right">{plan ? `${delivered} / ${quota}` : "—"}</Td>
                    <Td className="whitespace-nowrap text-ink-500">{relTime(c.lastTrackedAt)}</Td>
                    <Td>
                      <form action={viewAs}>
                        <input type="hidden" name="clientId" value={String(c._id)} />
                        <button className="whitespace-nowrap rounded-md px-2 py-1 text-[12.5px] font-medium text-ink-600 ring-1 ring-ink-200 hover:bg-white hover:text-ink-950">Open dashboard</button>
                      </form>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Empty title="No clients yet" action={<ButtonLink href="/admin/clients/new">Create the first client</ButtonLink>}>
            Clients appear here when they sign up and pay, or when you add one after a sales call.
          </Empty>
        )}
      </Card>
    </>
  );
}
