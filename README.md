# BayClusterLab

Done-for-you AI SEO. BayClusterLab gets a business named when buyers ask ChatGPT, Gemini, Perplexity, Google AI Overviews and others. It tracks buyer questions every day, audits the site, drafts content for human review, finds off-site opportunities, and shows all of it on a client dashboard.

## What's in the box

| Area | Where | What it does |
|---|---|---|
| Marketing site | `src/app/(site)` | Landing page, pricing, and the **free AI visibility check** (lead magnet, email-gated report) |
| Client dashboard | `src/app/app` | Overview (score, trend, share of voice, engines, work done, roadmap), buyer questions matrix + per-question answers, competitors, content approvals, site fixes, off-site, traffic (GSC + GA4), settings |
| Ops console | `src/app/admin` | MRR and plan mix, at-risk clients, server setup status, sales-led client creation, "open their dashboard", editorial review queue with fact-check gating, leads pipeline, job monitor |
| Answer engines | `src/lib/engines` | ChatGPT (OpenAI + web search), Gemini (Google Search grounding), Perplexity (Sonar), Claude (web search), Grok (xAI), Google organic and AI Overviews (Apify SERP), AI Mode and Copilot (configurable Apify actors) |
| Analysis | `src/lib/analysis` | Mention detection (regex, plus an optional cheap LLM pass for ordered brand lists and sentiment), visibility / position / citation / share-of-voice metrics |
| Audit | `src/lib/audit` | Native crawler (robots.txt AI-bot rules, llms.txt, sitemap, rendering, schema, answer-format and E-E-A-T checks) that produces a prioritised, deduplicated fix list; re-audits verify fixes automatically |
| Content engine | `src/lib/services/content.ts` | Monthly quota planning aimed at the questions where the client is weakest, GEO-style drafting with `[VERIFY: …]` markers in place of invented facts, WordPress publishing with FAQ schema |
| Jobs | `src/lib/jobs`, `src/worker` | Mongo-backed queue with retries, back-off, dedupe and stale-lock recovery; nightly fan-out runs tracking daily, audits on plan cadence, content monthly and off-site weekly |
| Billing | `src/lib/services/stripe.ts`, `src/app/api/stripe/webhook` | Stripe Checkout subscriptions, billing portal, webhook-driven plan and status sync |

Stack: Next.js 15 (App Router, server actions), TypeScript, Tailwind, MongoDB (Mongoose), Stripe. LLM and engine calls are plain `fetch`, with no vendor SDKs.

## Run it locally

```bash
cp .env.example .env            # fill in what you have; everything optional degrades gracefully
npm install
npm run seed:admin -- you@bayclusterlab.com "a-strong-password" "Your Name"   # email must also be in ADMIN_EMAILS
npm run seed:demo               # optional: demo workspace with 45 days of synthetic data
npm run dev                     # web on :3000 + worker
```

- Demo client login: `demo@bayclusterlab.com` / `demo-password`. Remove it with `npm run seed:demo -- --clean`.
- Without Stripe keys, choosing a plan activates it immediately (development mode).
- Without engine keys, the dashboard works but tracking and the free check fail with a clear error.
- `/api/health` lists which engines are live.

## Keys you need for production

| Key | Needed for | Notes |
|---|---|---|
| `MONGODB_URI`, `AUTH_SECRET`, `ADMIN_EMAILS`, `APP_URL` | Everything | `openssl rand -base64 48` for the secret |
| `ANTHROPIC_API_KEY` | Question writing, profiling, brand extraction, drafting, Claude engine | Falls back to OpenAI, then Gemini, for internal work |
| `OPENAI_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY` | Core engines (Starter) | |
| `APIFY_TOKEN` | Google, AI Overviews, Reddit/Quora (Growth/Scale) | Check the SERP actor's output still includes AI Overviews; parsing is defensive |
| `APIFY_AI_MODE_ACTOR`, `APIFY_COPILOT_ACTOR` | AI Mode, Copilot | No public APIs; leave blank until you pick reliable actors |
| `XAI_API_KEY` | Grok | |
| `STRIPE_*` | Checkout | Create three monthly prices; webhook events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` → `/api/stripe/webhook` |
| `GOOGLE_CLIENT_ID/SECRET` | Traffic page | OAuth client (web). Redirect URI `APP_URL/api/google/callback`. Enable Search Console API, Analytics Data API, Analytics Admin API. Needs Google verification before external users can connect. |
| `RESEND_API_KEY` | Email | Without it, emails are logged to the console |

## Deploy

**Recommended: Railway or Render.** Run two services from this repo, plus MongoDB Atlas:
- web: `npm run build && npm start`
- worker: `npm run worker` (runs the nightly schedule itself)

**Vercel-only alternative:** schedule `GET /api/jobs/tick` every minute and `GET /api/cron/daily` once a day, both with `Authorization: Bearer $CRON_SECRET`. Long tracking runs fit better on a real worker.

## Cost per client (rough, check against current pricing)

Each daily run makes `questions × engines × TRACK_SAMPLES` engine calls, plus one cheap extraction call per answer when `LLM_EXTRACTION=true`. Starter is 50 × 3 = 150 calls a day (~4,500 a month). Scale is 250 × 9 = 2,250 a day. **Price that before selling Scale.** The main levers are `TRACK_SAMPLES`, `LLM_EXTRACTION=false`, and tracking Scale's slower engines every other day.

## Guardrails built in

- Content can't reach a client, or be published, while any `[VERIFY: …]` marker remains. The drafting prompt forbids invented stats, quotes or customer names.
- Off-site work is framed as genuine participation: thread discovery for a human to reply, not posting automation.
- Clients can trigger a manual tracking run at most every 6 hours (real API spend). Free checks are limited per IP and cached per domain for 24h.
- The admin "view as" mode shows a persistent banner.

## Known gaps / next steps

- No automated tests yet.
- Password reset by email isn't built (admins can re-invite).
- Monthly PDF/email report to clients.
- Publisher pitches and data studies are listed in plans but have no tooling yet (manual for now).
- AI Mode and Copilot depend on third-party Apify actors you still need to choose.
