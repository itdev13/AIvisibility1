import { CompetitorsForm } from "@/components/forms";
import { Sparkline } from "@/components/charts";
import { Card, CardHeader, Empty, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { formatCompetitors } from "@/lib/competitors";
import { entityColors, latestRun, snapshots } from "@/lib/dashboard";
import { getPlan } from "@/lib/plans";
import { pct } from "@/lib/utils";

export default async function CompetitorsPage() {
  const { client } = await requireClient();
  const plan = getPlan(client.plan)!;
  const [snaps, run] = await Promise.all([snapshots(client._id, 30), latestRun(client._id)]);
  const latest = snaps.at(-1);
  const colors = entityColors(client);

  // Head-to-head per question/engine: who was named when the other wasn't.
  const valid = run.rows.filter((r) => !r.error && !r.empty);
  const h2h = client.competitors.map((c) => {
    let theyWin = 0;
    let youWin = 0;
    for (const r of valid) {
      const them = r.competitorMentions.some((m) => m.name === c.name);
      if (them && !r.mentioned) theyWin++;
      if (r.mentioned && !them) youWin++;
    }
    return { name: c.name, theyWin, youWin };
  });

  // Brands AI recommends that aren't tracked yet.
  const tracked = new Set([client.name, ...client.competitors.map((c) => c.name)].map((s) => s.toLowerCase()));
  const counts = new Map<string, number>();
  for (const r of valid) for (const b of r.brandsRanked) if (!/\./.test(b) && !tracked.has(b.toLowerCase())) counts.set(b, (counts.get(b) ?? 0) + 1);
  const untracked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const rows = [
    { name: client.name, you: true, vis: latest?.visibility ?? 0, sov: latest?.shareOfVoice ?? 0, trend: snaps.map((s) => s.visibility) },
    ...client.competitors.map((c) => ({
      name: c.name,
      domain: c.domain,
      you: false,
      vis: latest?.competitors.find((x) => x.name === c.name)?.visibility ?? 0,
      sov: latest?.competitors.find((x) => x.name === c.name)?.shareOfVoice ?? 0,
      trend: snaps.map((s) => s.competitors.find((x) => x.name === c.name)?.visibility ?? 0),
    })),
  ].sort((a, b) => b.vis - a.vis);

  return (
    <>
      <PageHeader title="Competitors" subtitle={`How you stack up in AI answers against the ${client.competitors.length} competitors you track (up to ${plan.competitors} on ${plan.name}).`} />

      <Card>
        {!latest ? (
          <Empty title="No data yet">Competitor results appear after your first check.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Brand</Th>
                <Th className="text-right">Named in answers</Th>
                <Th className="text-right">Share of voice</Th>
                <Th>30-day trend</Th>
                <Th className="text-right">Named instead of you</Th>
                <Th className="text-right">You're named, they aren't</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const h = h2h.find((x) => x.name === r.name);
                return (
                  <tr key={r.name} className={r.you ? "bg-[#F3F8FE]" : ""}>
                    <Td>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[r.name] ?? "#8E949D" }} />
                        <span className={r.you ? "font-semibold text-ink-950" : "font-medium"}>{r.name}</span>
                        {r.you && <span className="text-[11px] text-ink-400">you</span>}
                      </span>
                    </Td>
                    <Td className="tnum text-right font-semibold">{pct(r.vis)}</Td>
                    <Td className="tnum text-right">{pct(r.sov)}</Td>
                    <Td><Sparkline values={r.trend} color={colors[r.name] ?? "#8E949D"} /></Td>
                    <Td className="tnum text-right">{r.you ? "—" : <span className={h && h.theyWin > 0 ? "font-semibold text-bad" : ""}>{h?.theyWin ?? 0}</span>}</Td>
                    <Td className="tnum text-right">{r.you ? "—" : <span className={h && h.youWin > 0 ? "font-semibold text-good" : ""}>{h?.youWin ?? 0}</span>}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 serif text-[19px] text-ink-950">Tracked competitors</div>
          <CompetitorsForm competitors={formatCompetitors(client.competitors)} aliases={(client.aliases ?? []).join(", ")} max={plan.competitors} />
        </Card>
        <Card>
          <CardHeader title="Others AI recommends" subtitle="Named in your buyers' answers but not tracked yet" />
          {untracked.length ? (
            <ul className="mt-3 divide-y divide-ink-100">
              {untracked.map(([name, n]) => (
                <li key={name} className="flex items-center justify-between px-5 py-2.5 text-[13.5px]">
                  <span className="text-ink-800">{name}</span>
                  <span className="tnum text-ink-500">{n} mention{n > 1 ? "s" : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Nothing new">No untracked brands are showing up often.</Empty>
          )}
        </Card>
      </div>
    </>
  );
}
