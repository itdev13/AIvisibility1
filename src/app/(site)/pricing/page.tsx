import type { Metadata } from "next";
import { JsonLd } from "@/components/jsonld";
import { PricingTable } from "@/components/marketing";
import { notFound } from "next/navigation";
import { SHOW_PRICING, breadcrumb, faqSchema, serviceSchema } from "@/lib/seo";
import { ButtonLink, Notice } from "@/components/ui";
import { PLAN_LIST } from "@/lib/plans";
import { ENGINE_META } from "@/lib/engines/types";

export const metadata: Metadata = {
  title: "Pricing — AI SEO plans from $499/month",
  description: "SeoWaveTech plans: Starter $499, Growth $999, Scale $2,499 a month. Daily AI answer tracking, answer-first content and site fixes. No setup fee, cancel any time.",
  alternates: { canonical: "/pricing" },
  openGraph: { url: "/pricing", title: "SeoWaveTech pricing", description: "Done-for-you AI SEO from $499/month. No setup fee, cancel any time." },
};

const PRICING_FAQ: [string, string][] = [
  ["How much does AI SEO cost?", "Agencies that do AI SEO typically charge $3,000–$8,000 or more a month. Tracking tools cost $30–$500 a month but leave the work to you. SeoWaveTech is $499, $999 or $2,499 a month depending on how many buyer questions we track, how many AI engines we check and how much content we produce, and we do the work."],
  ["What's included in every plan?", "Every plan tracks your buyer questions daily on Claude, ChatGPT, Gemini and Perplexity, includes a full AI-readiness audit of your site, articles written and edited for you every month, competitor tracking and a live dashboard."],
  ["Which plan should I start with?", "Most businesses start on Growth. It adds Google, AI Overviews and AI Mode, money pages that win comparison questions, and monthly fixes we ship for you. Starter suits businesses that want tracking and content first. Scale adds off-site work: listings, reviews, Reddit and Quora, and publisher pitches."],
  ["Is there a contract or setup fee?", "No. Plans are billed monthly with no setup fee, and you can cancel any time from your billing settings."],
  ["Can I change plans later?", "Yes. You can upgrade or downgrade from your billing settings, and the change applies straight away."],
  ["Do you need access to my website?", "Only if you want us to publish or fix things for you. Connect WordPress and approved content publishes automatically. On other platforms we send you the finished pages, and fixes that need your access are marked for your team."],
];

const ROWS: [string, (p: (typeof PLAN_LIST)[number]) => string][] = [
  ["Articles per month", (p) => String(p.posts)],
  ["Money pages per month", (p) => (p.moneyPages ? String(p.moneyPages) : "—")],
  ["Existing pages improved", (p) => (p.pagesImproved ? `${p.pagesImproved}/mo` : "—")],
  ["Site audit", (p) => (p.auditCadence === "once" ? "Once, fix list handed over" : p.auditCadence === "monthly" ? "Monthly, we ship the fixes" : "Weekly, we ship the fixes")],
  ["Buyer questions tracked daily", (p) => String(p.questions)],
  ["AI engines", (p) => p.engines.map((e) => ENGINE_META[e].label).join(", ")],
  ["Competitors tracked", (p) => String(p.competitors)],
  ["Listings, directories & reviews", (p) => (p.offsite ? "✓" : "—")],
  ["Reddit & Quora opportunities", (p) => (p.offsite ? "✓" : "—")],
  ["Publisher pitches", (p) => (p.publisherPitches ? `${p.publisherPitches}/mo` : "—")],
  ["Monthly data study", (p) => (p.dataStudies ? "✓" : "—")],
  ["Search Console + GA4 reporting", (p) => (p.id === "starter" ? "—" : "✓")],
];

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ canceled?: string }> }) {
  // Hidden while we sell through conversations; flip SHOW_PRICING in lib/seo.ts to bring it back.
  if (!SHOW_PRICING) notFound();
  const { canceled } = await searchParams;
  return (
    <div className="mx-auto max-w-6xl px-5 py-20">
      <JsonLd data={[serviceSchema(), faqSchema(PRICING_FAQ), breadcrumb([{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }])]} />
      <div className="mx-auto max-w-2xl text-center">
        <div className="eyebrow">Pricing</div>
        <h1 className="display mt-4 text-[52px] text-ink-950 sm:text-[64px]">Pay for output, not hours.</h1>
        <p className="mt-4 text-[16px] text-ink-600">Every plan is done for you and billed monthly. No setup fee, no contract. Your dashboard is live within the hour.</p>
      </div>
      {canceled && <Notice tone="info" className="mx-auto mt-8 max-w-xl text-center">Checkout was cancelled. Nothing was charged.</Notice>}
      <div className="mt-14">
        <PricingTable />
      </div>

      <div className="mt-20">
        <h2 className="display text-[36px] text-ink-950">Compare plans</h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-200 bg-white shadow-card">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead>
              <tr className="border-b border-ink-150 text-left">
                <th className="px-6 py-4 font-medium text-ink-500" />
                {PLAN_LIST.map((p) => (
                  <th key={p.id} className="px-6 py-4 font-semibold text-ink-950">
                    {p.name} <span className="font-normal text-ink-500">${p.price.toLocaleString()}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, fn]) => (
                <tr key={label} className="border-b border-ink-100 last:border-0">
                  <td className="px-6 py-3.5 font-medium text-ink-800">{label}</td>
                  {PLAN_LIST.map((p) => (
                    <td key={p.id} className="px-6 py-3.5 text-ink-600">{fn(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section className="mt-20 grid gap-10 border-t border-ink-950 pt-6 md:grid-cols-[1fr_1.6fr]" aria-labelledby="pricing-faq">
        <div>
          <div className="eyebrow">Pricing questions</div>
          <h2 id="pricing-faq" className="display mt-5 text-[40px] text-ink-950">What does AI SEO cost?</h2>
          <p className="mt-3 text-[13px] text-ink-500">
            Prices updated <time dateTime="2026-11-09">November 9, 2026</time>
          </p>
        </div>
        <div className="divide-y divide-ink-200 border-y border-ink-200">
          {PRICING_FAQ.map(([q, a]) => (
            <div key={q} className="py-5">
              <h3 className="serif text-[20px] leading-snug text-ink-950">{q}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-16 flex flex-col items-center gap-4 rounded-2xl border border-ink-200 bg-white p-10 text-center shadow-card">
        <div className="text-[18px] font-semibold text-ink-950">Not sure which plan fits?</div>
        <p className="max-w-md text-[14px] text-ink-600">Run the free check first. You'll see your current AI visibility and the gaps each plan would close.</p>
        <ButtonLink href="/check" variant="lime">Run a free check</ButtonLink>
      </div>
    </div>
  );
}
