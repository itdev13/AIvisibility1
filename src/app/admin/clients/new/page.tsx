import Link from "next/link";
import { CreateClientForm } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export default async function NewClientPage() {
  await requireAdmin();
  return (
    <>
      <Link href="/admin/clients" className="mb-4 inline-block text-[13px] text-ink-500 hover:text-ink-900">← Clients</Link>
      <PageHeader
        title="New client"
        subtitle="For deals closed on a call. Creates the workspace, emails the client a login, and starts setup: questions, audit, first check and roadmap. Bill them through a Stripe invoice or payment link."
      />
      <Card className="max-w-3xl p-6 sm:p-8">
        <CreateClientForm />
      </Card>
    </>
  );
}
