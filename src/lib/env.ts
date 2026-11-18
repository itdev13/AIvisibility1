/** Centralised env access. Optional integrations return "" when unset so callers can feature-detect. */
const v = (k: string, fallback = "") => (process.env[k] ?? fallback).trim();

export const env = {
  appUrl: () => v("APP_URL", "http://localhost:3000").replace(/\/$/, ""),
  mongoUri: () => v("MONGODB_URI", "mongodb://127.0.0.1:27017/bayclusterlab"),
  authSecret: () => {
    const s = v("AUTH_SECRET");
    if (!s && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required in production");
    return s || "dev-only-insecure-secret-change-me-please-0000";
  },
  adminEmails: () =>
    v("ADMIN_EMAILS")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  cronSecret: () => v("CRON_SECRET"),

  openaiKey: () => v("OPENAI_API_KEY"),
  openaiModel: () => v("OPENAI_MODEL", "gpt-4.1-mini"),
  geminiKey: () => v("GEMINI_API_KEY"),
  geminiModel: () => v("GEMINI_MODEL", "gemini-3.8-flash"),
  perplexityKey: () => v("PERPLEXITY_API_KEY"),
  perplexityModel: () => v("PERPLEXITY_MODEL", "sonar"),
  anthropicKey: () => v("ANTHROPIC_API_KEY"),
  anthropicTrackModel: () => v("ANTHROPIC_TRACK_MODEL", "claude-sonnet-5-5"),
  anthropicWorkModel: () => v("ANTHROPIC_WORK_MODEL", "claude-sonnet-5-5"),
  anthropicFastModel: () => v("ANTHROPIC_FAST_MODEL", "claude-haiku-5-5"),
  /** Use an LLM to extract the ordered list of recommended brands from each answer (more accurate positions). */
  llmExtraction: () => v("LLM_EXTRACTION", "true") !== "false",
  xaiKey: () => v("XAI_API_KEY"),
  xaiModel: () => v("XAI_MODEL", "grok-4"),
  trackSamples: () => Math.max(1, Math.min(5, Number(v("TRACK_SAMPLES", "1")) || 1)),

  apifyToken: () => v("APIFY_TOKEN"),
  apifySerpActor: () => v("APIFY_SERP_ACTOR", "apify~google-search-scraper"),
  apifyRedditActor: () => v("APIFY_REDDIT_ACTOR", "trudax~reddit-scraper-lite"),
  apifyCrawlerActor: () => v("APIFY_CRAWLER_ACTOR", "apify~website-content-crawler"),
  apifyAiModeActor: () => v("APIFY_AI_MODE_ACTOR"),
  apifyCopilotActor: () => v("APIFY_COPILOT_ACTOR"),

  stripeKey: () => v("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => v("STRIPE_WEBHOOK_SECRET"),
  stripePrice: (plan: "starter" | "growth" | "scale") => v(`STRIPE_PRICE_${plan.toUpperCase()}`),

  googleClientId: () => v("GOOGLE_CLIENT_ID"),
  googleClientSecret: () => v("GOOGLE_CLIENT_SECRET"),

  resendKey: () => v("RESEND_API_KEY"),
  emailFrom: () => v("EMAIL_FROM", "BayClusterLab <hello@bayclusterlab.com>"),
};
