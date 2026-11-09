import Link from "next/link";
import { notFound } from "next/navigation";
import { runClientJob, updateClient, viewAs } from "@/app/actions/admin";
import { LineChart } from "@/components/charts";
import { SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, Field, PageHeader, Select, Stat, Table, Td, Textarea, Th } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { snapshots } from "@/lib/dashboard";
import { Client, Content, Fix, Job, Question, User, type ClientDoc, type JobDoc, type UserDoc } from "@/lib/models";
import { PLAN_LIST, getPlan } from "@/lib/plans";
import { money, monthKey, pct, relTime } from "@/lib/utils";

const JOBS = [
  ["track.client", "Run tracking"],
  ["audit.client", "Run audit"],
  ["content.plan", "Plan & draft content"],
  ["questions.fill", "Fill questions"],
  ["roadmap.generate", "Regenerate roadmap"],
  ["offsite.find", "Find off-site"],
  ["traffic.sync", "Sync traffic"],
] as const;

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) notFound();
  const c = await Client.findById(id).lean<ClientDoc>();
  if (!c) notFound();
  const plan = getPlan(c.plan);
  const [snaps, users, jobs, qCount, fixOpen, contentMonth] = await Promise.all([
    snapshots(c._id, 60),
    User.find({ clientId: c._id }).lean<UserDoc[]>(),
    Job.find({ "payload.clientId": id }).sort({ createdAt: -1 }).limit(12).lean<JobDoc[]>(),
    Question.countDocuments({ clientId: c._id, active: true }),
    Fix.countDocuments({ clientId: c._id, status: { $in: ["open", "in_progress"] } }),
    Content.aggregate<{ _id: string; n: number }>([{ $match: { clientId: c._id, month: monthKey() } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const last = snaps.at(-1);

  return (
    <>
      <Link href="/admin/clients" className="mb-4 inline-block text-[13px] text-ink-500 hover:text-ink-900">← Clients</Link>
      <PageHeader
        title={c.name}
        subtitle={`${c.domain} · ${c.category}${c.location ? ` · ${c.location}` : ""}`}
        actions={
          <form action={viewAs}>
            <input type="hidden" name="clientId" value={id} />
            <SubmitButton size="sm">Open their dashboard</SubmitButton>
          </form>
        }
      />

      <Card className="grid grid-cols-2 gap-px overflow-hidden bg-ink-150 md:grid-cols-5">
        {[
          ["Score", last?.score ?? "—"],
          ["Named in answers", last ? pct(last.visibility) : "—"],
          ["Active questions", `${qCount} / ${plan?.questions ?? "—"}`],
          ["Open fixes", fixOpen],
          ["MRR", plan && c.status === "active" ? money(plan.price) : "—"],
        ].map(([l, v]) => (
          <div key={l as string} className="bg-white p-5">
            <Stat label={l} value={v} />
          </div>
        ))}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="AI visibility score, last 60 days" />
          <div className="p-5">
            <LineChart series={[{ name: c.name, color: "#2a78d6", emphasis: true, points: snaps.map((s) => ({ x: s.date, y: s.score })) }]} yMax={100} height={200} />
          </div>
        </Card>
        <Card className="p-5">
          <div className="serif text-[19px] text-ink-950">Account</div>
          <form action={updateClient} className="mt-4 space-y-4">
            <input type="hidden" name="id" value={id} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Plan">
                <Select name="plan" defaultValue={c.plan ?? ""}>
                  {PLAN_LIST.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue={c.status}>
                  {["onboarding", "active", "past_due", "canceled"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Internal notes">
              <Textarea name="notes" rows={4} defaultValue={c.notes} />
            </Field>
            <SubmitButton variant="outline">Save</SubmitButton>
          </form>
          <p className="mt-3 text-[12px] text-ink-500">Plan changes here don't touch Stripe. Change billing in the Stripe dashboard too.</p>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="serif text-[19px] text-ink-950">Run now</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {JOBS.map(([type, label]) => (
              <form key={type} action={runClientJob}>
                <input type="hidden" name="clientId" value={id} />
                <input type="hidden" name="type" value={type} />
                <SubmitButton variant="outline" size="sm" pendingText="Queued">{label}</SubmitButton>
              </form>
            ))}
          </div>
          <div className="mt-5 text-[13px] text-ink-600">
            Content this month:{" "}
            {contentMonth.length ? contentMonth.map((x) => `${x.n} ${x._id.replace("_", " ")}`).join(" · ") : "none yet"}
          </div>
        </Card>
        <Card>
          <CardHeader title="Users" />
          <ul className="mt-3 divide-y divide-ink-100">
            {users.length ? (
              users.map((u) => (
                <li key={String(u._id)} className="flex items-center justify-between px-5 py-2.5 text-[13.5px]">
                  <span>
                    <span className="font-medium text-ink-900">{u.name || "—"}</span> <span className="text-ink-500">{u.email}</span>
                  </span>
                  <span className="text-[12px] text-ink-400">last login {relTime(u.lastLoginAt)}</span>
                </li>
              ))
            ) : (
              <li className="px-5 py-3 text-[13.5px] text-ink-500">No client logins yet.</li>
            )}
          </ul>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="Recent jobs" />
        <Table className="mt-3">
          <thead>
            <tr><Th>Job</Th><Th>Status</Th><Th>Attempts</Th><Th>Created</Th><Th>Error</Th></tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={String(j._id)}>
                <Td className="font-mono text-[12px]">{j.type}</Td>
                <Td><Badge tone={j.status === "done" ? "good" : j.status === "failed" ? "bad" : "info"}>{j.status}</Badge></Td>
                <Td className="tnum">{j.attempts}</Td>
                <Td className="text-ink-500">{relTime(j.createdAt)}</Td>
                <Td className="max-w-[360px] truncate text-[12px] text-bad">{j.lastError}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
