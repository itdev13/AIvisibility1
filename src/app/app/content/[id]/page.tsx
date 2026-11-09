import Link from "next/link";
import { notFound } from "next/navigation";
import { clientApprove, clientRequestChanges } from "@/app/actions/workspace";
import { SubmitButton } from "@/components/forms";
import { Badge, Card, Notice, Textarea } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { Content, type ContentDoc } from "@/lib/models";
import { relTime } from "@/lib/utils";
import { CLIENT_STATUS, TYPE_LABEL } from "@/lib/content-labels";

export default async function ContentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) notFound();
  const { client } = await requireClient();
  const c = await Content.findOne({ _id: id, clientId: client._id, status: { $ne: "rejected" } }).lean<ContentDoc>();
  if (!c) notFound();
  const st = CLIENT_STATUS[c.status];
  const hasBody = ["client_review", "approved", "published"].includes(c.status) && c.body;

  return (
    <>
      <Link href="/app/content" className="mb-4 inline-block text-[13px] text-ink-500 hover:text-ink-900">← All content</Link>
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="px-6 py-8 sm:px-12 sm:py-12">
          {hasBody ? (
            <article className="prose-mq mx-auto max-w-[68ch]" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.body) }} />
          ) : (
            <div className="mx-auto max-w-[68ch]">
              <h1 className="display text-[38px] text-ink-950">{c.title}</h1>
              <Notice tone="info" className="mt-6">
                {c.status === "planned" ? "This piece is planned. Writing starts shortly." : c.status === "drafting" ? "Our platform is writing the first draft." : "Our editors are reviewing and fact-checking the draft. You'll get an email when it's ready for you."}
              </Notice>
              {c.brief && (
                <>
                  <div className="eyebrow mb-2 mt-8">Brief</div>
                  <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink-700">{c.brief}</p>
                </>
              )}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <Badge tone={st.tone} dot>{st.label}</Badge>
            <dl className="mt-4 space-y-3 text-[13px]">
              {[
                ["Type", TYPE_LABEL[c.type]],
                ["Answers", c.targetQuestion || "—"],
                ["Words", c.wordCount ? c.wordCount.toLocaleString() : "—"],
                ["Updated", relTime(c.updatedAt)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-ink-500">{k}</dt>
                  <dd className="mt-0.5 text-ink-900">{v}</dd>
                </div>
              ))}
              {c.publishedUrl && (
                <div>
                  <dt className="text-ink-500">Live at</dt>
                  <dd className="mt-0.5 break-all"><a href={c.publishedUrl} target="_blank" rel="noreferrer" className="text-series-1 underline">{c.publishedUrl}</a></dd>
                </div>
              )}
              {c.metaDescription && (
                <div>
                  <dt className="text-ink-500">Meta description</dt>
                  <dd className="mt-0.5 text-ink-700">{c.metaDescription}</dd>
                </div>
              )}
            </dl>
          </Card>

          {c.status === "client_review" && (
            <Card className="p-5">
              <div className="serif text-[19px] text-ink-950">Your approval</div>
              <p className="mt-1 text-[13px] text-ink-500">
                {client.integrations?.wordpress?.url ? "Once approved, we publish it to your site automatically." : "Once approved, we'll publish it or send it to your team."}
              </p>
              <form action={clientApprove} className="mt-4">
                <input type="hidden" name="id" value={id} />
                <SubmitButton className="w-full" pendingText="Approving…">Approve</SubmitButton>
              </form>
              <form action={clientRequestChanges} className="mt-4 space-y-2 border-t border-ink-100 pt-4">
                <input type="hidden" name="id" value={id} />
                <Textarea name="notes" rows={3} placeholder="What should we change?" required />
                <SubmitButton variant="outline" className="w-full">Request changes</SubmitButton>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
