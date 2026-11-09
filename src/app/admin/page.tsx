import Link from "next/link";
import { BarList } from "@/components/charts";
import { Badge, Card, CardHeader, Empty, Notice, PageHeader, Stat, Table, Td, Th } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { availableEngines } from "@/lib/engines";
import { Client, Content, Job, Lead, Snapshot, type ClientDoc, type LeadDoc, type SnapshotDoc } from "@/lib/models";
import { PLANS, PLAN_LIST } from "@/lib/plans";
import { apifyAvailable } from "@/lib/apify";
import { llmAvailable } from "@/lib/ai/llm";
import { stripeAvailable } from "@/lib/services/stripe";
import { googleAvailable } from "@/lib/services/google";
import { daysAgo, money, relTime } from "@/lib/utils";

export default async function AdminHome() {
  await requireAdmin();
  const [clients, leads7, recentLeads, inReview, failed, lastDaily] = await Promise.all([
    Client.find({}).lean<ClientDoc[]>(),
    Lead.countDocuments({ createdAt: { $gt: new Date(Date.now() - 7 * 86_400_000) } }),
    Lead.find({}).sort({ createdAt: -1 }).limit(6).lean<LeadDoc[]>(),
    Content.countDocuments({ status: "review" }),
    Job.countDocuments({ status: "failed", finishedAt: { $gt: new Date(Date.now() - 86_400_000) } }),
    Job.findOne({ type: "daily", status: "done" }).sort({ finishedAt: -1 }).lean(),
  ]);
  const active = clients.filter((c) => c.status === "active" && c.plan);
  const mrr = active.reduce((s, c) => s + PLANS[c.plan!].price, 0);
  const pastDue = clients.filter((c) => c.status === "past_due");

  // At-risk: visibility fell week over week.
  const snaps = await Snapshot.find({ clientId: { $in: active.map((c) => c._id) }, date: { $gte: daysAgo(9) } }).sort({ date: 1 }).lean<SnapshotDoc[]>();
  const atRisk = active
    .map((c) => {
      const s = snaps.filter((x) => String(x.clientId) === String(c._id));
      const first = s[0];
      const last = s.at(-1);
      return { c, drop: first && last && first !== last ? last.visibility - first.visibility : 0, score: last?.score };
    })
    .filter((x) => x.drop < -0.05)
    .sort((a, b) => a.drop - b.drop);

  const engines = availableEngines().map((e) => e.label);
  const config = [
    ["AI engines", engines.length ? engines.join(", ") : "None configured", engines.length >= 3],
    ["Work model (LLM)", llmAvailable() ? "Configured" : "Missing", llmAvailable()],
    ["Apify", apifyAvailable() ? "Configured" : "Missing — no Google/AIO/Reddit", apifyAvailable()],
    ["Stripe", stripeAvailable() ? "Configured" : "Dev mode (no payments)", stripeAvailable()],
    ["Google OAuth", googleAvailable() ? "Configured" : "Missing — no GSC/GA4", googleAvailable()],
  ] as const;

  return (
    <>
      <PageHeader title="Ops overview" subtitle="The business at a glance." eyebrow={lastDaily ? `Nightly run ${relTime(lastDaily.finishedAt)}` : "Nightly run hasn't completed yet"} />
      {(pastDue.length > 0 || failed > 0) && (
        <Notice tone="warn" className="mb-5">
          {pastDue.length > 0 && <>{pastDue.length} client{pastDue.length > 1 ? "s" : ""} past due. </>}
          {failed > 0 && <><Link href="/admin/jobs" className="font-semibold underline">{failed} job{failed > 1 ? "s" : ""} failed</Link> in the last 24h.</>}
        </Notice>
      )}
      <Card className="grid grid-cols-2 gap-px overflow-hidden bg-ink-150 md:grid-cols-5">
        {[
          ["MRR", money(mrr), `ARR ${money(mrr * 12)}`],
          ["Active clients", active.length, `${clients.filter((c) => c.status === "onboarding").length} onboarding`],
          ["Past due", pastDue.length, pastDue.length ? money(pastDue.reduce((s, c) => s + (c.plan ? PLANS[c.plan].price : 0), 0)) + " at risk" : "All paid"],
          ["New leads (7d)", leads7, "From the free check"],
          ["Awaiting review", inReview, "Drafts for editors"],
        ].map(([l, v, sub]) => (
          <div key={l as string} className="bg-white p-5">
            <Stat label={l} value={v} sub={sub} />
          </div>
        ))}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Plan mix" subtitle="Active clients by plan" />
          <div className="p-5">
            <BarList
              format="int"
              rows={PLAN_LIST.map((p, i) => ({ name: `${p.name} · ${money(p.price)}`, value: active.filter((c) => c.plan === p.id).length, color: ["#2a78d6", "#eb6834", "#1baf7a"][i] }))}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Visibility dropping" subtitle="Down more than 5 pts this week" />
          {atRisk.length ? (
            <ul className="mt-3 divide-y divide-ink-100">
              {atRisk.slice(0, 6).map(({ c, drop }) => (
                <li key={String(c._id)} className="flex items-center justify-between px-5 py-2.5 text-[13.5px]">
                  <Link href={`/admin/clients/${c._id}`} className="font-medium text-ink-900 hover:underline">{c.name}</Link>
                  <span className="tnum font-semibold text-bad">▼ {Math.round(Math.abs(drop) * 100)} pts</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="All steady">No client lost meaningful visibility this week.</Empty>
          )}
        </Card>
        <Card>
          <CardHeader title="Setup" subtitle="What's configured on this server" />
          <ul className="mt-3 divide-y divide-ink-100">
            {config.map(([k, v, ok]) => (
              <li key={k} className="flex items-start justify-between gap-3 px-5 py-2.5 text-[13px]">
                <span className="text-ink-700">{k}</span>
                <span className={ok ? "text-right text-good" : "text-right text-warn"}>{v}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="Latest leads" action={<Link href="/admin/leads" className="text-[13px] text-ink-500 hover:text-ink-900">All leads →</Link>} />
        {recentLeads.length ? (
          <Table className="mt-3">
            <thead>
              <tr><Th>Email</Th><Th>Site</Th><Th className="text-right">Score</Th><Th>Status</Th><Th>When</Th></tr>
            </thead>
            <tbody>
              {recentLeads.map((l) => (
                <tr key={String(l._id)}>
                  <Td className="font-medium text-ink-900">{l.email}</Td>
                  <Td>{l.checkId ? <Link href={`/report/${l.checkId}`} className="hover:underline">{l.domain}</Link> : l.domain}</Td>
                  <Td className="tnum text-right">{l.score ?? "—"}</Td>
                  <Td><Badge className="capitalize">{l.status.replace("_", " ")}</Badge></Td>
                  <Td className="text-ink-500">{relTime(l.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty title="No leads yet">Leads arrive when someone unlocks their free report.</Empty>
        )}
      </Card>
    </>
  );
}
