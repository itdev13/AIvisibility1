import Link from "next/link";
import { PLAN_LIST } from "@/lib/plans";
import { ENGINE_META, type EngineId } from "@/lib/engines/types";
import { cn } from "@/lib/utils";
import { SHOW_LOGIN, SHOW_PRICING } from "@/lib/seo";
import { ButtonLink, Logo } from "./ui";

/** Masthead: a dateline strip, then the nameplate row with a hard rule beneath. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="hidden border-b border-ink-200 md:block">
        <div className="eyebrow mx-auto flex h-8 max-w-6xl items-center justify-between px-5 !text-[10px]">
          <span>For small businesses · AI visibility, done for you</span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-good animate-pulse-dot" /> Tracking Claude · ChatGPT · Gemini · Perplexity · Google AI daily
          </span>
        </div>
      </div>
      <div className="border-b border-ink-950">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Link href="/" aria-label="Mentiq home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-8 text-[14px] text-ink-700 md:flex">
            {[
              ["Who we help", "/#who"],
              ["How it works", "/#how"],
              ["What we do", "/#what"],
              ...(SHOW_PRICING ? [["Pricing", "/pricing"]] : []),
              ["FAQ", "/#faq"],
              ["Free check", "/check"],
            ].map(([l, h]) => (
              <Link key={h} href={h} className="decoration-lime decoration-[3px] underline-offset-[6px] hover:text-ink-950 hover:underline">
                {l}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {SHOW_LOGIN && <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">Sign in</ButtonLink>}
            <ButtonLink href="/#contact" size="sm">Talk to us</ButtonLink>
          </div>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t-[3px] border-double border-ink-950 bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <Logo size="lg" />
          <p className="mt-4 max-w-xs font-display text-[18px] italic leading-snug text-ink-700">
            When buyers ask AI, be the answer.
          </p>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ink-500">We get small businesses recommended when customers ask Claude, ChatGPT, Gemini, Perplexity and Google's AI. We do the work; you get the customers.</p>
        </div>
        {[
          ["What we do", [["Who we help", "/#who"], ["How it works", "/#how"], ["Free AI visibility check", "/check"], ...(SHOW_PRICING ? [["Pricing", "/pricing"]] : [])]],
          ["Talk to us", [["Get in touch", "/#contact"], ["FAQ", "/#faq"], ...(SHOW_LOGIN ? [["Client sign in", "/login"]] : [])]],
          ["Engines", (["claude", "chatgpt", "gemini", "perplexity", "google_aio"] as EngineId[]).map((e) => [ENGINE_META[e].label, "/#engines"])],
        ].map(([title, links]) => (
          <div key={title as string}>
            <div className="eyebrow mb-4 border-b border-ink-950 pb-2">{title as string}</div>
            <ul className="space-y-2.5 text-[14px] text-ink-700">
              {(links as string[][]).map(([l, h]) => (
                <li key={l}><Link href={h} className="hover:text-ink-950 hover:underline">{l}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-ink-200">
        <div className="eyebrow mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-5 !text-[10px]">
          <span>© {new Date().getFullYear()} Mentiq AI</span>
          <span>Not affiliated with OpenAI, Google, Perplexity, Anthropic, Microsoft or xAI</span>
        </div>
      </div>
    </footer>
  );
}

export function PricingTable({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid border border-ink-950 bg-white lg:grid-cols-3">
      {PLAN_LIST.map((p, i) => (
        <div
          key={p.id}
          className={cn(
            "relative flex flex-col p-7 sm:p-8",
            i > 0 && "border-t border-ink-950 lg:border-l lg:border-t-0",
            p.highlight && "bg-ink-950 text-white",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="eyebrow" style={p.highlight ? { color: "rgba(252,250,245,.6)" } : undefined}>
              No. {String(i + 1).padStart(2, "0")} · {p.name}
            </div>
            {p.highlight && <span className="bg-lime px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-950">Most popular</span>}
          </div>
          <div className={cn("mt-5 font-display text-[22px] italic leading-snug", p.highlight ? "text-white/85" : "text-ink-700")}>{p.tagline}</div>
          <div className="mt-6 flex items-baseline gap-1.5">
            <span className="display tnum text-[58px] leading-none">${p.price.toLocaleString()}</span>
            <span className={cn("font-mono text-[12px]", p.highlight ? "text-white/50" : "text-ink-500")}>/mo</span>
          </div>
          <div className={cn("mt-2 font-mono text-[11px] uppercase tracking-wider", p.highlight ? "text-white/45" : "text-ink-400")}>No setup fee · cancel any time</div>
          <ButtonLink href={`/signup?plan=${p.id}`} variant={p.highlight ? "lime" : "primary"} className="mt-7 w-full">
            Start with {p.name}
          </ButtonLink>
          <ul className={cn("mt-8 space-y-3 border-t pt-6 text-[14px]", p.highlight ? "border-white/15" : "border-ink-200", compact && "hidden sm:block")}>
            {p.features.map((f) => (
              <li key={f} className="flex gap-3">
                <span className={cn("mt-[3px] font-mono text-[11px]", p.highlight ? "text-lime" : "text-ink-400")}>→</span>
                <span className={p.highlight ? "text-white/85" : "text-ink-800"}>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Hero visual: an AI answer as a press clipping, with the client's name highlighted. */
export function AnswerMock() {
  return (
    <div className="relative">
      <div className="relative rotate-[0.6deg] border border-ink-950 bg-white shadow-[6px_6px_0_0_#12100D]">
        <div className="flex items-center justify-between border-b border-ink-950 px-4 py-2">
          <span className="eyebrow !text-ink-700">Answer · ChatGPT</span>
          <span className="eyebrow">09:41</span>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <p className="font-display text-[21px] italic leading-snug text-ink-950">“What's the best physiotherapy clinic in Austin for a sports injury?”</p>
          <div className="space-y-2.5 text-[14px] leading-relaxed text-ink-700">
            <p>Three well-reviewed options for sports injuries in Austin:</p>
            <ol className="space-y-2.5">
              <li className="flex gap-3">
                <span className="font-mono text-[12px] text-ink-400">01</span>
                <span>
                  <b className="hl-swipe font-semibold text-ink-950">Your Clinic</b> specialises in return-to-sport rehab, offers same-week appointments and runs gait analysis on site.<sup className="ml-0.5 font-mono text-[10px] text-ink-500">[1]</sup>
                </span>
              </li>
              <li className="flex gap-3"><span className="font-mono text-[12px] text-ink-400">02</span><span>Competitor A, a large multi-location practice…<sup className="ml-0.5 font-mono text-[10px] text-ink-500">[2]</sup></span></li>
              <li className="flex gap-3"><span className="font-mono text-[12px] text-ink-400">03</span><span>Competitor B, known for post-surgical care…<sup className="ml-0.5 font-mono text-[10px] text-ink-500">[3]</sup></span></li>
            </ol>
          </div>
          <div className="border-t border-dashed border-ink-300 pt-3 font-mono text-[11px] leading-relaxed text-ink-500">
            [1] <span className="hl-under text-ink-900">yourclinic.com</span> &nbsp;[2] healthgrades.com &nbsp;[3] reddit.com/r/Austin
          </div>
        </div>
      </div>
      <div className="absolute -bottom-16 -left-6 hidden w-56 -rotate-[1.5deg] border border-ink-950 bg-lime p-4 shadow-hard sm:block">
        <div className="eyebrow !text-ink-800">Named in AI answers</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="display tnum text-[44px] leading-none text-ink-950">64%</span>
          <span className="font-mono text-[12px] font-semibold text-ink-950">▲ 41 pts</span>
        </div>
        <div className="mt-1 font-mono text-[9.5px] uppercase tracking-wider text-ink-700">Illustrative · 12 weeks</div>
      </div>
    </div>
  );
}
