import type { Metadata } from "next";
import { CheckForm } from "@/components/forms";
import { EngineChip } from "@/components/ui";

export const metadata: Metadata = {
  title: "Free AI visibility check — does AI recommend you?",
  description: "Enter your website and see in about two minutes how often Claude, ChatGPT, Gemini and Perplexity recommend you, who they recommend instead, and what to fix. Free, no card.",
  alternates: { canonical: "/check" },
  openGraph: { url: "/check", title: "Does AI recommend your business? Free check", description: "See how often AI assistants name you, and who they pick instead. Free, two minutes." },
};

export default function CheckPage() {
  return (
    <section className="relative overflow-hidden">
      <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_70%)]" />
      <div className="relative mx-auto max-w-3xl px-5 pb-28 pt-20 text-center">
        <div className="eyebrow">Free AI visibility check</div>
        <h1 className="display mt-5 text-[52px] text-ink-950 sm:text-[66px]">
          Does AI recommend you, <em>or your competitors?</em>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-ink-600">
          Enter your website. We'll work out what you do, write the questions your buyers ask, put them to the AI engines live, and score how visible you are.
        </p>
        <div className="mx-auto mt-9 max-w-xl text-left">
          <CheckForm autoFocus />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2">
          {["claude", "chatgpt", "gemini", "perplexity"].map((e) => (
            <EngineChip key={e} id={e} />
          ))}
        </div>
        <div className="mx-auto mt-16 grid max-w-2xl gap-4 text-left sm:grid-cols-3">
          {[
            ["Your AI visibility score", "How often you're named, how high, and whether your site is cited."],
            ["Who AI picks instead", "The businesses AI recommends when it doesn't name you."],
            ["AI-readiness audit", "Crawler access, structured data and content checks, with fixes."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-ink-200 bg-white p-4 shadow-card">
              <div className="text-[14px] font-semibold text-ink-950">{t}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
