import type { EngineId } from "./engines/types";

export type PlanId = "starter" | "growth" | "scale";

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  tagline: string;
  posts: number;
  moneyPages: number;
  pagesImproved: number;
  questions: number;
  competitors: number;
  engines: EngineId[];
  auditCadence: "once" | "monthly" | "weekly";
  offsite: boolean;
  dataStudies: boolean;
  publisherPitches: number;
  features: string[];
  highlight?: boolean;
}

// Claude leads every plan; order here is the display order everywhere.
const CORE: EngineId[] = ["claude", "chatgpt", "gemini", "perplexity"];
const SEARCH: EngineId[] = [...CORE, "google", "google_aio", "ai_mode"];
const ALL: EngineId[] = [...SEARCH, "copilot", "grok"];

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    price: 499,
    tagline: "Get on the map in AI answers.",
    posts: 10,
    moneyPages: 0,
    pagesImproved: 0,
    questions: 50,
    competitors: 3,
    engines: CORE,
    auditCadence: "once",
    offsite: false,
    dataStudies: false,
    publisherPitches: 0,
    features: [
      "10 AI-ready articles a month, written and reviewed",
      "Full AI-readiness audit with a prioritised fix list",
      "50 buyer questions tracked daily",
      "Claude, ChatGPT, Gemini and Perplexity",
      "Track 3 competitors",
      "Live client dashboard",
    ],
  },
  growth: {
    id: "growth",
    name: "Growth",
    price: 999,
    tagline: "Win the comparison questions.",
    posts: 15,
    moneyPages: 5,
    pagesImproved: 6,
    questions: 100,
    competitors: 5,
    engines: SEARCH,
    auditCadence: "monthly",
    offsite: false,
    dataStudies: false,
    publisherPitches: 0,
    highlight: true,
    features: [
      "15 articles + 5 money pages a month",
      "6 existing pages improved every month",
      "Monthly audit — we ship every fix",
      "100 buyer questions tracked daily",
      "Adds Google, AI Overviews and AI Mode",
      "Track 5 competitors",
      "Search Console + GA4 AI-traffic reporting",
    ],
  },
  scale: {
    id: "scale",
    name: "Scale",
    price: 2499,
    tagline: "Own your category across every engine.",
    posts: 20,
    moneyPages: 10,
    pagesImproved: 20,
    questions: 250,
    competitors: 10,
    engines: ALL,
    auditCadence: "weekly",
    offsite: true,
    dataStudies: true,
    publisherPitches: 50,
    features: [
      "20 articles + 10 money pages a month",
      "20 pages improved every month",
      "Weekly audits and fixes",
      "Listings, directories and review profiles",
      "Reddit & Quora opportunity finding",
      "50 publisher pitches a month",
      "Monthly original data study",
      "250 questions across 9 AI engines",
      "Track 10 competitors",
    ],
  },
};

export const PLAN_LIST = [PLANS.starter, PLANS.growth, PLANS.scale];

export function getPlan(id: string | null | undefined): Plan | null {
  return id && id in PLANS ? PLANS[id as PlanId] : null;
}
