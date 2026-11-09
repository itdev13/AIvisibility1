import { findOpportunitiesNow, setOpportunityStatus } from "@/app/actions/workspace";
import { SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { Opportunity, type OpportunityDoc } from "@/lib/models";
import { getPlan } from "@/lib/plans";
import { relTime } from "@/lib/utils";

const GROUPS: { type: OpportunityDoc["type"]; title: string; subtitle: string }[] = [
  { type: "directory", title: "Listings & directories", subtitle: "AI engines check these to confirm you're real and well-reviewed." },
  { type: "reddit", title: "Reddit threads", subtitle: "Where buyers ask your questions. A genuine, helpful reply from your team is what earns a mention." },
  { type: "quora", title: "Quora questions", subtitle: "Questions that rank in Google and get pulled into AI answers." },
  { type: "publisher", title: "Publisher pitches", subtitle: "Articles and roundups worth being included in." },
];

const STATUS_TONE = { new: "info", in_progress: "warn", done: "good", skipped: "neutral" } as const;

export default async function OffsitePage() {
  const { client } = await requireClient();
  const plan = getPlan(client.plan)!;

  if (!plan.offsite) {
    return (
      <>
        <PageHeader title="Off-site" subtitle="Get mentioned on the sites AI trusts." />
        <Card className="p-10 text-center">
          <Badge tone="lime">Scale plan</Badge>
          <h2 className="display mt-4 text-[30px] text-ink-950">AI recommends businesses other sites talk about</h2>
          <p className="mx-auto mt-2 max-w-lg text-[14px] leading-relaxed text-ink-600">
            On Scale we claim and complete your listings and review profiles, find the Reddit and Quora threads where your buyers ask questions, and pitch you to publishers. That's 50 pitches a month, plus a monthly data study.
          </p>
          <ButtonLink href="/app/settings#billing" className="mt-6">Upgrade to Scale</ButtonLink>
        </Card>
      </>
    );
  }

  const items = await Opportunity.find({ clientId: client._id, status: { $ne: "skipped" } }).sort({ score: -1, createdAt: -1 }).limit(300).lean<OpportunityDoc[]>();

  return (
    <>
      <PageHeader
        title="Off-site"
        subtitle="Mentions on trusted sites are among the strongest signals AI engines use. Our specialists work this list every week."
        actions={
          <form action={findOpportunitiesNow}>
            <SubmitButton variant="outline" size="sm" pendingText="Queued">Find new opportunities</SubmitButton>
          </form>
        }
      />
      <div className="space-y-5">
        {GROUPS.map((g) => {
          const list = items.filter((i) => i.type === g.type);
          return (
            <Card key={g.type}>
              <CardHeader title={g.title} subtitle={g.subtitle} action={<span className="tnum text-[12.5px] text-ink-500">{list.filter((l) => l.status === "done").length} / {list.length} done</span>} />
              {list.length ? (
                <ul className="mt-3 divide-y divide-ink-100">
                  {list.map((o) => (
                    <li key={String(o._id)} className="flex flex-wrap items-start gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <a href={o.url} target="_blank" rel="noreferrer noopener" className="text-[13.5px] font-medium text-ink-900 hover:underline">{o.title || o.url}</a>
                        {o.snippet && <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-[12.5px] text-ink-500">{o.snippet}</p>}
                        {o.question && <p className="mt-1 text-[11.5px] text-ink-400">Related to: {o.question}</p>}
                      </div>
                      <Badge tone={STATUS_TONE[o.status]} className="capitalize">{o.status.replace("_", " ")}</Badge>
                      <form action={setOpportunityStatus} className="flex gap-1">
                        <input type="hidden" name="id" value={String(o._id)} />
                        {o.status !== "done" && <button name="status" value="done" className="rounded-md px-2 py-1 text-[12px] text-ink-600 hover:bg-ink-100">Done</button>}
                        {o.status === "new" && <button name="status" value="in_progress" className="rounded-md px-2 py-1 text-[12px] text-ink-600 hover:bg-ink-100">Start</button>}
                        <button name="status" value="skipped" className="rounded-md px-2 py-1 text-[12px] text-ink-400 hover:bg-ink-100">Skip</button>
                      </form>
                      <span className="w-14 text-right text-[11.5px] text-ink-400">{relTime(o.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty title="None yet">New opportunities are found weekly.</Empty>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
