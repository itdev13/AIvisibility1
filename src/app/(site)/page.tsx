import type { Metadata } from "next";
import { BarList, LineChart, SERIES } from "@/components/charts";
import { CheckForm, ContactForm } from "@/components/forms";
import { JsonLd } from "@/components/jsonld";
import { AnswerMock, PricingTable } from "@/components/marketing";
import { ButtonLink, EngineChip, ScoreRing } from "@/components/ui";
import { ALL_ENGINE_IDS } from "@/lib/engines";
import { SHOW_PRICING, faqSchema, serviceSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Get your small business recommended by AI",
  description:
    "Your customers now ask ChatGPT, Claude, Gemini and Google's AI who to hire. Mentiq finds out what AI says about your business, then does all the work to get you recommended. Free check, no jargon.",
  alternates: { canonical: "/" },
};

/* Illustrative dashboard data for the "you'll see it working" preview (labelled on the page). */
const days = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, 7, 3 + i * 7)).toISOString().slice(0, 10));
const demo = {
  you: [9, 11, 12, 15, 19, 24, 29, 33, 38, 44, 49, 54],
  a: [41, 42, 40, 42, 41, 40, 39, 40, 38, 37, 37, 36],
  b: [28, 27, 29, 28, 27, 27, 26, 25, 26, 24, 24, 23],
};

/** The kinds of small business we help, each with a real question their customers ask AI. */
const WHO: [string, string][] = [
  ["Clinics & dentists", "“Which dentist near me is good with nervous patients?”"],
  ["Lawyers & accountants", "“Best accountant for a small online shop in my city?”"],
  ["Home services", "“Who's a reliable plumber that can come today?”"],
  ["Gyms, salons & studios", "“Best yoga studio for beginners near me?”"],
  ["Restaurants & cafés", "“Where's a good quiet café to work from nearby?”"],
  ["Local shops & online stores", "“Where can I buy handmade gifts that ship fast?”"],
  ["Agencies & consultants", "“Which marketing agency is good for small brands?”"],
  ["Schools & tutors", "“Best maths tutor for a 10-year-old near me?”"],
];

const FAQ: [string, string][] = [
  ["I'm a small business. Does AI search really matter for me?", "Yes, and more each month. People who used to search Google now ask ChatGPT, Claude, Gemini or Google's AI Overviews “who should I use?”. The AI names a few businesses and the customer usually picks one of them. If you're not named, that customer never finds you."],
  ["What do I have to do?", "Very little. You tell us about your business once and approve anything we write before it goes live. We do the checking, the website fixes, the content, the listings and the reporting."],
  ["How do I know if AI recommends me right now?", "Run our free check. In about two minutes you'll see a sample of the questions your customers ask AI, whether you're named in the answers, and which businesses are named instead."],
  ["How long until AI starts recommending me?", "Some fixes, like making your website readable to AI, can show up within weeks. Content and listings usually take one to three months to be picked up. You'll see the progress every month, in plain English."],
  ["Can you guarantee results?", "No one honestly can. AI answers change every day. What we guarantee is the work: everything we agree to do, done every month, with the results shown to you so you can judge for yourself."],
  ["Will you change my website?", "Only with your approval. We can publish directly if your site runs on WordPress. On other platforms we send you the finished pages and a simple list of changes."],
  ["How much does it cost?", "It depends on your business and how much work is needed. After a free check we'll suggest a fixed monthly price. There's no setup fee and no long contract."],
];

function SectionHead({ kicker, title, children, id }: { kicker: string; title: React.ReactNode; children?: React.ReactNode; id?: string }) {
  return (
    <div className="grid gap-6 border-t border-ink-950 pt-6 md:grid-cols-[200px_1fr]">
      <div className="eyebrow">{kicker}</div>
      <div>
        <h2 id={id} className="display text-[40px] text-ink-950 sm:text-[56px]">{title}</h2>
        {children && <div className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-600">{children}</div>}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <JsonLd data={[serviceSchema(), faqSchema(FAQ)]} />

      {/* ───── Front page ───── */}
      <section className="relative overflow-hidden">
        <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-5 pb-24 pt-14 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
          <div className="min-w-0 animate-fade-up">
            <div className="eyebrow flex items-center gap-3">
              <span className="h-px w-8 bg-ink-950" /> For small businesses
            </div>
            <h1 className="display mt-6 text-[46px] text-ink-950 sm:text-[68px] lg:text-[76px]">
              Your customers are asking AI who to choose.{" "}
              <em className="italic">
                <span className="hl-swipe">Make sure it says you.</span>
              </em>
            </h1>
            <p className="mt-7 max-w-xl text-[18px] leading-relaxed text-ink-700">
              Most small businesses have no idea what ChatGPT, Claude, Gemini or Google's AI tell people about them. We find out, then do all the work to get you recommended. No dashboards to learn and no jargon.
            </p>
            <div className="mt-9 max-w-xl">
              <CheckForm />
              <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-ink-500">
                <span>→ Free, about 2 minutes</span>
                <span>→ No card needed</span>
                <a href="#contact" className="text-ink-950 underline decoration-lime decoration-[3px] underline-offset-4 hover:decoration-ink-950">
                  → Or talk to us
                </a>
              </p>
            </div>
          </div>
          <div className="min-w-0 animate-fade-up [animation-delay:120ms]">
            <AnswerMock />
          </div>
        </div>
      </section>

      {/* ───── Engines ───── */}
      <section id="engines" className="border-y border-ink-950 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-5">
          <span className="eyebrow !text-ink-950">We check every day →</span>
          {ALL_ENGINE_IDS.map((e) => (
            <EngineChip key={e} id={e} />
          ))}
        </div>
      </section>

      {/* ───── The problem ───── */}
      <section className="noise bg-ink-950 text-white">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="eyebrow !text-white/55">What's changed</div>
          <blockquote className="display mt-6 max-w-4xl text-[38px] sm:text-[58px]">
            Customers stopped scrolling search results. <em className="text-white/50">They ask AI, and AI names three businesses.</em>
          </blockquote>
          <div className="mt-14 grid border-t border-white/20 sm:grid-cols-3">
            {[
              ["If you're not named, you're invisible", "The customer picks from the businesses the AI mentions. Everyone else is skipped, however good they are."],
              ["Being on Google isn't enough", "AI assistants read different signals than Google's ranking. Plenty of businesses on page one are never recommended by AI."],
              ["You can't see it happening", "There's no report telling you what AI says about you. That's the first thing we fix: you'll know exactly where you stand."],
            ].map(([t, d], i) => (
              <div key={t} className={`py-7 sm:pr-6 ${i > 0 ? "border-t border-white/20 sm:border-l sm:border-t-0 sm:pl-6" : ""}`}>
                <div className="serif text-[22px] leading-snug">{t}</div>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-white/65">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Who we help ───── */}
      <section id="who" className="mx-auto max-w-6xl scroll-mt-28 px-5 py-24">
        <SectionHead kicker="Who we help" title={<>Small businesses that live on <em>being found.</em></>}>
          If your customers search before they buy, they're starting to ask AI. Here's what they ask in your line of work.
        </SectionHead>
        <div className="mt-12 grid border-l border-t border-ink-950 sm:grid-cols-2 lg:grid-cols-4">
          {WHO.map(([t, q]) => (
            <div key={t} className="border-b border-r border-ink-950 bg-white p-6">
              <h3 className="serif text-[20px] leading-snug text-ink-950">{t}</h3>
              <p className="mt-3 font-display text-[16px] italic leading-snug text-ink-600">{q}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───── How it works (a real sequence) ───── */}
      <section id="how" className="border-y border-ink-950 bg-ink-100/70">
        <div className="mx-auto max-w-6xl scroll-mt-28 px-5 py-24">
          <SectionHead kicker="How it works" title={<>You run your business. <em>We handle AI.</em></>} />
          <ol className="mt-14 grid border-y border-ink-950 md:grid-cols-3">
            {[
              ["We show you where you stand", "A free check shows the questions your customers ask AI, whether you're named, and who's recommended instead. No cost, no commitment."],
              ["We do all the work", "We fix your website so AI can read it, write pages that answer your customers' questions, and tidy your listings and reviews. You approve anything before it goes live."],
              ["You get recommended, and see it", "We check AI every day. Each month you get a short, plain-English report: how often you're named, what changed and what we did."],
            ].map(([t, d], i) => (
              <li key={t} className={`py-9 md:px-8 ${i > 0 ? "border-t border-ink-950 md:border-l md:border-t-0" : "md:pl-0"}`}>
                <div className="font-mono text-[12px] text-ink-500">Step {i + 1}</div>
                <h3 className="serif mt-4 text-[24px] leading-snug text-ink-950">{t}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-600">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───── What we do ───── */}
      <section id="what" className="mx-auto max-w-6xl scroll-mt-28 px-5 py-24">
        <SectionHead kicker="What we do for you" title={<>Everything AI needs to <span className="hl">recommend you.</span></>} />
        <div className="mt-12 grid gap-x-12 md:grid-cols-2">
          {[
            ["Check what AI says about you, every day", "We ask Claude, ChatGPT, Gemini, Perplexity and Google's AI the questions your customers ask, and record whether you're named and who's named instead."],
            ["Fix your website so AI can read it", "Many small-business sites accidentally block AI or hide their details. We find the problems and fix them, or give your web person a simple list."],
            ["Write pages that answer real questions", "Clear, useful pages about your services, prices, area and expertise, written in your voice. An editor checks every fact and you approve before anything goes live."],
            ["Tidy your listings and reviews", "AI checks sites like Google Business, Yelp and industry directories to decide who's trustworthy. We make sure your details are complete and consistent."],
            ["Keep an eye on your competitors", "See which local businesses AI recommends instead of you, and what it would take to overtake them."],
            ["Report back in plain English", "One short monthly summary: how often AI recommends you now, what changed, and what we're doing next."],
          ].map(([t, d]) => (
            <div key={t} className="grid grid-cols-[28px_1fr] gap-3 border-b border-ink-200 py-6">
              <span className="mt-1 font-mono text-[14px] text-ink-950">✓</span>
              <div>
                <h3 className="serif text-[21px] leading-snug text-ink-950">{t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───── Proof preview ───── */}
      <section className="border-y border-ink-950 bg-ink-100/70">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <SectionHead kicker="You'll see it working" title={<>From invisible to <em>recommended.</em></>}>
            Every client gets a simple view of how often AI names them, against the competitors they care about.
          </SectionHead>
          <figure className="mt-12">
            <div className="border border-ink-950 bg-white shadow-[6px_6px_0_0_#12100D]">
              <div className="flex items-center justify-between border-b border-ink-950 px-5 py-2.5">
                <span className="eyebrow !text-ink-800">A local clinic · 12 weeks</span>
                <span className="eyebrow">Illustrative example</span>
              </div>
              <div className="grid lg:grid-cols-[250px_1fr_290px]">
                <div className="flex flex-col items-center justify-center border-b border-ink-200 p-8 lg:border-b-0 lg:border-r">
                  <ScoreRing score={58} size={130} />
                  <p className="mt-5 text-center text-[13px] leading-relaxed text-ink-600">Named in <b>54%</b> of AI answers, up from 9% at the start.</p>
                </div>
                <div className="min-w-0 border-b border-ink-200 p-6 lg:border-b-0 lg:border-r">
                  <div className="serif mb-3 text-[18px] text-ink-950">How often AI names each clinic</div>
                  <LineChart
                    height={230}
                    yMax={60}
                    format="pct"
                    series={[
                      { name: "The clinic", color: SERIES[0], emphasis: true, points: days.map((x, i) => ({ x, y: demo.you[i] })) },
                      { name: "Competitor A", color: SERIES[1], points: days.map((x, i) => ({ x, y: demo.a[i] })) },
                      { name: "Competitor B", color: SERIES[2], points: days.map((x, i) => ({ x, y: demo.b[i] })) },
                    ]}
                  />
                </div>
                <div className="p-6">
                  <div className="serif mb-4 text-[18px] text-ink-950">Share of recommendations</div>
                  <BarList
                    rows={[
                      { name: "The clinic", value: 0.41, color: SERIES[0], highlight: true },
                      { name: "Competitor A", value: 0.32, color: SERIES[1] },
                      { name: "Competitor B", value: 0.27, color: SERIES[2] },
                    ]}
                  />
                </div>
              </div>
            </div>
            <figcaption className="mt-4 font-display text-[15px] italic text-ink-500">An illustrative example of what progress looks like, not a real client's results.</figcaption>
          </figure>
        </div>
      </section>

      {SHOW_PRICING && (
        <section className="mx-auto max-w-6xl px-5 py-24">
          <SectionHead kicker="Pricing" title={<>Simple, monthly, <em>no setup fee.</em></>} />
          <div className="mt-12">
            <PricingTable />
          </div>
        </section>
      )}

      {/* ───── FAQ ───── */}
      <section id="faq" className="mx-auto max-w-6xl scroll-mt-28 px-5 py-24">
        <div className="grid gap-10 border-t border-ink-950 pt-6 md:grid-cols-[1fr_1.6fr]">
          <div>
            <div className="eyebrow">Questions</div>
            <h2 className="display mt-6 text-[40px] text-ink-950 sm:text-[52px]">
              What small business owners <em>ask us.</em>
            </h2>
          </div>
          <div className="divide-y divide-ink-200 border-y border-ink-200">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6">
                  <h3 className="serif text-[20px] leading-snug text-ink-950">{q}</h3>
                  <span className="mt-1 font-mono text-[18px] leading-none text-ink-500 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 pr-10 text-[15px] leading-relaxed text-ink-600">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Talk to us ───── */}
      <section id="contact" className="scroll-mt-28 px-5 pb-24">
        <div className="mx-auto grid max-w-6xl border border-ink-950 bg-white lg:grid-cols-[1fr_1.2fr]">
          <div className="noise border-b border-ink-950 bg-ink-950 p-8 text-white sm:p-12 lg:border-b-0 lg:border-r">
            <div className="eyebrow !text-white/55">Talk to us</div>
            <h2 className="display mt-5 text-[40px] sm:text-[52px]">
              Want AI to <em>recommend you?</em>
            </h2>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-white/70">
              Tell us a little about your business. We'll check how AI sees you today and come back with a simple plan and a fixed monthly price.
            </p>
            <div className="mt-10 border-t border-white/20 pt-6">
              <div className="eyebrow !text-white/55">Prefer to see it first?</div>
              <ButtonLink href="/check" variant="lime" className="mt-4">Run the free check</ButtonLink>
            </div>
          </div>
          <div className="p-8 sm:p-12">
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}

export const dynamic = "force-static";
