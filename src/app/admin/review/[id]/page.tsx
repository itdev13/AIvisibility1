import Link from "next/link";
import { notFound } from "next/navigation";
import { markPublished, publishNow, redraft, saveDraft, setContentStatus } from "@/app/actions/admin";
import { SubmitButton } from "@/components/forms";
import { Badge, Card, Field, Input, Notice, Textarea } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { TYPE_LABEL } from "@/lib/content-labels";
import { renderMarkdown } from "@/lib/markdown";
import { Client, Content, type ClientDoc, type ContentDoc } from "@/lib/models";
import { relTime } from "@/lib/utils";

export default async function ReviewEditor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { err } = await searchParams;
  if (!/^[a-f0-9]{24}$/.test(id)) notFound();
  const c = await Content.findById(id).lean<ContentDoc>();
  if (!c) notFound();
  const client = await Client.findById(c.clientId).lean<ClientDoc>();
  const flags = [...c.body.matchAll(/\[VERIFY:([^\]]*)\]/g)].map((m) => m[1].trim());
  const wp = Boolean(client?.integrations?.wordpress?.url);

  return (
    <>
      <Link href="/admin/review" className="mb-4 inline-block text-[13px] text-ink-500 hover:text-ink-900">← Review queue</Link>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="display text-[32px] text-ink-950">{c.title}</h1>
        <Badge tone="info" className="capitalize">{c.status.replace("_", " ")}</Badge>
        <span className="text-[13px] text-ink-500">{client?.name} · {TYPE_LABEL[c.type]} · {c.wordCount} words · updated {relTime(c.updatedAt)}</span>
      </div>

      {err === "verify" && <Notice tone="bad" className="mb-4">Resolve every [VERIFY] marker before sending this to the client.</Notice>}
      {c.reviewNotes && <Notice tone="warn" className="mb-4">{c.reviewNotes}</Notice>}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="grid gap-5 2xl:grid-cols-2">
          <Card className="p-5">
            <form action={saveDraft} className="space-y-4">
              <input type="hidden" name="id" value={id} />
              <Field label="Title"><Input name="title" defaultValue={c.title} /></Field>
              <Field label="Meta description" hint="Under 155 characters."><Input name="metaDescription" defaultValue={c.metaDescription} maxLength={160} /></Field>
              <Field label="Body (Markdown)">
                <Textarea name="body" defaultValue={c.body} rows={34} className="font-mono text-[12.5px] leading-[1.65]" />
              </Field>
              <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
            </form>
          </Card>
          <Card className="px-6 py-8">
            <div className="eyebrow mb-4">Preview (last saved)</div>
            <article className="prose-mq" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.body || "_No draft yet._") }} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="text-[14px] font-semibold text-ink-950">Brief</div>
            <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink-600">{c.brief || "—"}</p>
            {c.targetQuestion && <p className="mt-3 text-[12.5px] text-ink-500">Target question: {c.targetQuestion}</p>}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-ink-950">Fact-check</span>
              <Badge tone={flags.length ? "warn" : "good"}>{flags.length ? `${flags.length} open` : "Clear"}</Badge>
            </div>
            {flags.length ? (
              <ul className="mt-3 space-y-2 text-[12.5px] text-ink-700">
                {flags.map((f, i) => <li key={i} className="rounded-lg bg-warn-soft px-2.5 py-1.5">{f}</li>)}
              </ul>
            ) : (
              <p className="mt-2 text-[12.5px] text-ink-500">No [VERIFY] markers left.</p>
            )}
          </Card>

          <Card className="space-y-3 p-5">
            <div className="text-[14px] font-semibold text-ink-950">Actions</div>
            {c.status === "review" && (
              <>
                <form action={setContentStatus}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="status" value="client_review" />
                  <SubmitButton className="w-full" disabled={flags.length > 0}>Send to client for approval</SubmitButton>
                </form>
                <form action={setContentStatus}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="status" value="approved" />
                  <SubmitButton variant="outline" className="w-full" disabled={flags.length > 0}>Approve without client review</SubmitButton>
                </form>
              </>
            )}
            {c.status === "approved" && (
              <>
                {wp && (
                  <form action={publishNow}>
                    <input type="hidden" name="id" value={id} />
                    <SubmitButton className="w-full" pendingText="Queued">Publish to WordPress</SubmitButton>
                  </form>
                )}
                <form action={markPublished} className="space-y-2">
                  <input type="hidden" name="id" value={id} />
                  <Input name="url" placeholder="https://… live URL" required />
                  <SubmitButton variant="outline" className="w-full">Mark as published</SubmitButton>
                </form>
              </>
            )}
            <form action={redraft} className="space-y-2 border-t border-ink-100 pt-3">
              <input type="hidden" name="id" value={id} />
              <Textarea name="notes" rows={3} placeholder="Notes for the rewrite (optional)" />
              <SubmitButton variant="outline" className="w-full" pendingText="Queued">Redraft with AI</SubmitButton>
            </form>
            <form action={setContentStatus} className="space-y-2 border-t border-ink-100 pt-3">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value="rejected" />
              <Input name="notes" placeholder="Reason for dropping" />
              <SubmitButton variant="danger" className="w-full">Drop this piece</SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
