import { connectGoogle } from "@/app/actions/workspace";
import { BarList, LineChart } from "@/components/charts";
import { SubmitButton } from "@/components/forms";
import { ButtonLink, Card, CardHeader, Empty, Notice, PageHeader, Stat } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { Traffic, type TrafficDoc } from "@/lib/models";
import { googleAvailable } from "@/lib/services/google";
import { daysAgo, num } from "@/lib/utils";

/** Map raw GA4 sources to the assistant they came from. */
const SOURCE_NAME: [RegExp, string][] = [
  [/chatgpt|openai/i, "ChatGPT"],
  [/perplexity/i, "Perplexity"],
  [/gemini|bard/i, "Gemini"],
  [/copilot/i, "Copilot"],
  [/claude|anthropic/i, "Claude"],
  [/grok/i, "Grok"],
];
const nameFor = (src: string) => SOURCE_NAME.find(([re]) => re.test(src))?.[1] ?? "Other AI";

export default async function TrafficPage() {
  const { client } = await requireClient();
  const g = client.integrations?.google;

  if (!g?.refreshToken) {
    return (
      <>
        <PageHeader title="Traffic" subtitle="Visitors and conversions arriving from AI assistants and search." />
        <Card className="p-10 text-center">
          <h2 className="display text-[30px] text-ink-950">Connect Search Console and Google Analytics</h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-ink-600">
            Read-only access lets us show visitors from ChatGPT, Perplexity, Gemini and others, plus your Google clicks and impressions, next to your AI visibility.
          </p>
          {googleAvailable() ? (
            <form action={connectGoogle} className="mt-6">
              <SubmitButton>Connect Google</SubmitButton>
            </form>
          ) : (
            <Notice tone="warn" className="mx-auto mt-6 max-w-md">Google OAuth isn't configured on the server (GOOGLE_CLIENT_ID / SECRET).</Notice>
          )}
        </Card>
      </>
    );
  }

  if (!g.gscSite && !g.ga4Property) {
    return (
      <>
        <PageHeader title="Traffic" />
        <Card className="p-8">
          <Empty title="Choose your property" action={<ButtonLink href="/app/settings#google">Go to settings</ButtonLink>}>
            Google is connected. Pick your Search Console site and GA4 property in Settings.
          </Empty>
        </Card>
      </>
    );
  }

  const rows = await Traffic.find({ clientId: client._id, date: { $gte: daysAgo(90) } }).sort({ date: 1 }).lean<TrafficDoc[]>();
  const last28 = rows.filter((r) => r.date >= daysAgo(28));
  const prev28 = rows.filter((r) => r.date < daysAgo(28) && r.date >= daysAgo(56));
  const sum = (rs: TrafficDoc[], k: keyof TrafficDoc) => rs.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const delta = (k: keyof TrafficDoc) => {
    const a = sum(last28, k);
    const b = sum(prev28, k);
    return b ? { value: a - b, label: `${Math.round(Math.abs((a - b) / b) * 100)}%` } : null;
  };
  const bySource = new Map<string, number>();
  for (const r of last28) for (const [src, n] of Object.entries(r.aiBySource ?? {})) bySource.set(nameFor(src), (bySource.get(nameFor(src)) ?? 0) + n);
  const SOURCE_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];

  return (
    <>
      <PageHeader title="Traffic" subtitle="Last 28 days compared with the 28 days before." eyebrow={`Google · ${g.email}`} />
      {!rows.length ? (
        <Card><Empty title="Syncing">The first sync is running. Data appears within a few minutes.</Empty></Card>
      ) : (
        <>
          <Card className="grid grid-cols-2 gap-px overflow-hidden bg-ink-150 md:grid-cols-4">
            {[
              ["Visitors from AI", num(sum(last28, "aiSessions")), delta("aiSessions")],
              ["Conversions from AI", num(sum(last28, "aiConversions")), delta("aiConversions")],
              ["Google clicks", num(sum(last28, "clicks")), delta("clicks")],
              ["Google impressions", num(sum(last28, "impressions")), delta("impressions")],
            ].map(([l, v, d]) => (
              <div key={l as string} className="bg-white p-5">
                <Stat label={l as string} value={v as string} delta={d as any} />
              </div>
            ))}
          </Card>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <Card>
              <CardHeader title="Visitors from AI assistants" subtitle="GA4 sessions, by day" />
              <div className="p-5">
                <LineChart series={[{ name: "AI visitors", color: "#2a78d6", emphasis: true, points: rows.map((r) => ({ x: r.date, y: r.aiSessions })) }]} height={220} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Which assistants" subtitle="Last 28 days" />
              <div className="p-5">
                {bySource.size ? (
                  <BarList format="num" rows={[...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([name, v], i) => ({ name, value: v, color: SOURCE_COLORS[i] ?? "#8E949D" }))} />
                ) : (
                  <p className="text-[13.5px] text-ink-500">No AI referral visits yet.</p>
                )}
              </div>
            </Card>
          </div>
          <Card className="mt-5">
            <CardHeader title="Google Search clicks" subtitle="Search Console, by day" />
            <div className="p-5">
              <LineChart series={[{ name: "Clicks", color: "#1baf7a", emphasis: true, points: rows.map((r) => ({ x: r.date, y: r.clicks })) }]} height={200} />
            </div>
          </Card>
        </>
      )}
    </>
  );
}
