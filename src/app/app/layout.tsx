import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { exitViewAs } from "@/app/actions/admin";
import { TopNav, type NavItem } from "@/components/shell";
import { Logo } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { Content } from "@/lib/models";
import { getPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Client workspace: a newspaper masthead (dateline, nameplate, section tabs) over a single wide column. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, client, viewingAs } = await requireClient();
  const plan = getPlan(client.plan);
  const awaiting = await Content.countDocuments({ clientId: client._id, status: "client_review" });
  const dateline = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const items: NavItem[] = [
    { href: "/app", label: "Briefing", icon: "overview" },
    { href: "/app/questions", label: "Buyer questions", icon: "questions" },
    { href: "/app/competitors", label: "Competitors", icon: "competitors" },
    { href: "/app/content", label: "Content", icon: "content", badge: awaiting },
    { href: "/app/fixes", label: "Site fixes", icon: "fixes" },
    { href: "/app/offsite", label: "Off-site", icon: "offsite", locked: !plan?.offsite },
    { href: "/app/traffic", label: "Traffic", icon: "traffic" },
    { href: "/app/settings", label: "Settings", icon: "settings" },
  ];

  return (
    <div className="min-h-screen">
      {viewingAs && (
        <div className="flex items-center justify-center gap-3 bg-lime px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-950" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6px)" }}>
          Staff view · {client.name}
          <form action={exitViewAs}>
            <button className="border border-ink-950 px-2 py-0.5 hover:bg-ink-950 hover:text-lime">Back to Ops</button>
          </form>
        </div>
      )}
      {client.status === "past_due" && (
        <div className="border-b border-warn/30 bg-warn-soft px-4 py-2 text-center text-[13px] text-[#6E4100]">
          Your last payment failed. <Link href="/app/settings#plan" className="font-semibold underline">Update billing</Link> to keep tracking and content running.
        </div>
      )}

      <header className="sticky top-0 z-40 bg-paper/92 backdrop-blur-md" style={viewingAs ? undefined : { paddingTop: "env(safe-area-inset-top, 0px)" }}>
        {/* Dateline */}
        <div className="border-b border-ink-200">
          <div className="eyebrow mx-auto flex h-8 max-w-[1280px] items-center justify-between gap-4 px-5 !text-[10px]">
            <span className="truncate">{dateline}</span>
            <span className="hidden items-center gap-2 sm:flex">
              The daily AI visibility briefing for <span className="text-ink-950">{client.name}</span>
              {plan && <span className="bg-ink-950 px-1.5 py-[1px] text-lime">{plan.name}</span>}
            </span>
          </div>
        </div>
        {/* Nameplate */}
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 pt-4">
          <Link href="/app" aria-label="Briefing">
            <Logo size="lg" />
          </Link>
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-[5px] px-2 py-1.5 hover:bg-ink-150/70">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-ink-950 font-display text-[15px] text-lime">
                {(user.name || user.email).slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block max-w-[180px] truncate text-[13px] font-medium leading-tight text-ink-950">{user.name || user.email}</span>
                <span className="block max-w-[180px] truncate font-mono text-[10.5px] leading-tight text-ink-500">{client.domain}</span>
              </span>
              <span className="font-mono text-[10px] text-ink-500 transition group-open:rotate-180">▾</span>
            </summary>
            <div className="absolute right-0 z-50 mt-2 w-56 border border-ink-950 bg-white py-1 shadow-lift">
              <div className="border-b border-ink-200 px-3 py-2 text-[12px] text-ink-500">{user.email}</div>
              <Link href="/app/settings" className="block px-3 py-2 text-[13.5px] text-ink-800 hover:bg-lime">Settings</Link>
              <Link href="/app/settings#plan" className="block px-3 py-2 text-[13.5px] text-ink-800 hover:bg-lime">Plan &amp; billing</Link>
              {!viewingAs && (
                <form action={logout}>
                  <button className="block w-full px-3 py-2 text-left text-[13.5px] text-ink-800 hover:bg-lime">Sign out</button>
                </form>
              )}
            </div>
          </details>
        </div>
        {/* Section tabs */}
        <div className="border-b border-ink-950">
          <div className="mx-auto mt-2 max-w-[1280px] px-5">
            <TopNav items={items} base="/app" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-5 py-8 lg:py-10">{children}</main>
    </div>
  );
}
