import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { TopNav, type NavItem } from "@/components/shell";
import { ButtonLink, Logo } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { Content, Job, Lead } from "@/lib/models";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Ops desk: same masthead as the client briefing, with a black "internal" dateline so staff never confuse the two. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const [review, leads, failed] = await Promise.all([
    Content.countDocuments({ status: "review" }),
    Lead.countDocuments({ status: "new" }),
    Job.countDocuments({ status: "failed", finishedAt: { $gt: new Date(Date.now() - 7 * 86_400_000) } }),
  ]);
  const items: NavItem[] = [
    { href: "/admin", label: "Desk", icon: "overview" },
    { href: "/admin/clients", label: "Clients", icon: "clients" },
    { href: "/admin/review", label: "Review queue", icon: "review", badge: review },
    { href: "/admin/leads", label: "Leads", icon: "leads", badge: leads },
    { href: "/admin/jobs", label: "Jobs", icon: "jobs", badge: failed },
  ];
  const dateline = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 bg-paper/92 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="bg-ink-950">
          <div className="eyebrow mx-auto flex h-8 max-w-[1280px] items-center justify-between gap-4 px-5 !text-[10px] !text-white/60">
            <span className="flex items-center gap-2">
              <span className="bg-lime px-1.5 py-[1px] text-ink-950">Ops desk</span> Internal · SeoWaveTech staff only
            </span>
            <span className="hidden sm:block">{dateline}</span>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 pt-4">
          <Link href="/admin" aria-label="Ops desk">
            <Logo size="lg" />
          </Link>
          <div className="flex items-center gap-3">
            <ButtonLink href="/admin/clients/new" variant="lime" size="sm">+ New client</ButtonLink>
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[5px] px-2 py-1.5 hover:bg-ink-150/70">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-ink-950 font-display text-[15px] text-lime">{(user.name || user.email).slice(0, 1).toUpperCase()}</span>
                <span className="font-mono text-[10px] text-ink-500 transition group-open:rotate-180">▾</span>
              </summary>
              <div className="absolute right-0 z-50 mt-2 w-56 border border-ink-950 bg-white py-1 shadow-lift">
                <div className="border-b border-ink-200 px-3 py-2 text-[12px] text-ink-500">{user.email}</div>
                <form action={logout}>
                  <button className="block w-full px-3 py-2 text-left text-[13.5px] text-ink-800 hover:bg-lime">Sign out</button>
                </form>
              </div>
            </details>
          </div>
        </div>
        <div className="border-b border-ink-950">
          <div className="mx-auto mt-2 max-w-[1280px] px-5">
            <TopNav items={items} base="/admin" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-5 py-8 lg:py-10">{children}</main>
    </div>
  );
}
