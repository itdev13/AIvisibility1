import type { Types } from "mongoose";

/** Explicit document shapes for every collection (kept in sync with schemas in models.ts). */
type Id = Types.ObjectId;
interface Base {
  _id: Id;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDoc extends Base {
  email: string;
  name: string;
  passwordHash: string;
  role: "client" | "admin";
  clientId: Id | null;
  lastLoginAt?: Date;
  googleId?: string;
}

export interface Competitor {
  name: string;
  domain: string;
  aliases: string[];
}

export interface RoadmapItem {
  month: number;
  area: string;
  title: string;
  detail: string;
  done: boolean;
}

export type ClientStatus = "onboarding" | "active" | "past_due" | "canceled";

export interface ClientDoc extends Base {
  name: string;
  website: string;
  domain: string;
  category: string;
  description: string;
  location: string;
  audience: string;
  aliases: string[];
  competitors: Competitor[];
  plan: "starter" | "growth" | "scale" | null;
  status: ClientStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  currentPeriodEnd?: Date | null;
  onboardedAt?: Date | null;
  roadmap: { generatedAt?: Date | null; summary: string; items: RoadmapItem[] };
  integrations: {
    google: { refreshToken: string; email: string; gscSite: string; ga4Property: string; connectedAt?: Date | null };
    wordpress: { url: string; username: string; appPassword: string };
  };
  lastTrackedAt?: Date | null;
  lastAuditAt?: Date | null;
  lastContentPlanMonth: string;
  notes: string;
}

export type Intent = "discovery" | "comparison" | "problem" | "local" | "brand";
export interface QuestionDoc extends Base {
  clientId: Id;
  text: string;
  intent: Intent;
  active: boolean;
}

export interface TrackingResultDoc extends Base {
  clientId: Id;
  questionId: Id;
  runId: string;
  date: string;
  engine: string;
  answer: string;
  mentioned: boolean;
  position: number | null;
  brandsRanked: string[];
  competitorMentions: { name: string; position: number }[];
  cited: boolean;
  citations: string[];
  sentiment: "positive" | "neutral" | "negative" | null;
  error: string;
  empty: boolean;
}

export interface EngineStat {
  visibility: number;
  answers: number;
  citationRate: number;
}
export interface SnapshotDoc extends Base {
  clientId: Id;
  date: string;
  runId: string;
  score: number;
  visibility: number;
  citationRate: number;
  avgPosition: number | null;
  shareOfVoice: number;
  answers: number;
  byEngine: Record<string, EngineStat>;
  competitors: { name: string; visibility: number; shareOfVoice: number }[];
}

export interface CheckRow {
  id: string;
  title: string;
  area: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  page: string;
}
export interface AuditDoc extends Base {
  clientId: Id | null;
  url: string;
  score: number;
  pagesScanned: number;
  checks: CheckRow[];
  aiBots: Record<string, boolean>;
  source: string;
}

export type FixStatus = "open" | "in_progress" | "done" | "wont_fix";
export interface FixDoc extends Base {
  clientId: Id;
  auditId?: Id;
  key: string;
  title: string;
  detail: string;
  area: "ai-access" | "technical" | "schema" | "content" | "offsite";
  impact: "high" | "medium" | "low";
  page: string;
  owner: "seowavetech" | "client";
  status: FixStatus;
  doneAt?: Date | null;
}

export type ContentStatus = "planned" | "drafting" | "review" | "client_review" | "approved" | "published" | "rejected";
export interface ContentDoc extends Base {
  clientId: Id;
  type: "blog" | "money_page" | "refresh";
  month: string;
  title: string;
  slug: string;
  targetQuestion: string;
  keywords: string[];
  brief: string;
  body: string;
  metaDescription: string;
  faq: { q: string; a: string }[];
  sourceUrl: string;
  status: ContentStatus;
  reviewNotes: string;
  reviewedBy: string;
  wordCount: number;
  publishedUrl: string;
  wpPostId: number | null;
  publishedAt?: Date | null;
}

export interface OpportunityDoc extends Base {
  clientId: Id;
  type: "reddit" | "quora" | "directory" | "publisher" | "review";
  title: string;
  url: string;
  snippet: string;
  question: string;
  score: number;
  status: "new" | "in_progress" | "done" | "skipped";
}

export interface TrafficDoc extends Base {
  clientId: Id;
  date: string;
  clicks: number;
  impressions: number;
  position: number | null;
  sessions: number;
  aiSessions: number;
  aiBySource: Record<string, number>;
  conversions: number;
  aiConversions: number;
}

export interface FreeCheckResult {
  question: string;
  engine: string;
  mentioned: boolean;
  position: number;
  brandsRanked: string[];
  citations: string[];
  excerpt: string;
}
export interface FreeCheckDoc extends Base {
  url: string;
  domain: string;
  status: "queued" | "running" | "done" | "failed";
  step: string;
  progress: number;
  brand: string;
  category: string;
  location: string;
  summary: string;
  engines: string[];
  questions: string[];
  results: FreeCheckResult[];
  score: number;
  visibility: number;
  rivals: { name: string; count: number }[];
  checks: CheckRow[];
  readiness: number;
  email: string;
  unlocked: boolean;
  ip: string;
  error: string;
}

export interface LeadDoc extends Base {
  email: string;
  domain: string;
  name: string;
  source: string;
  checkId?: Id;
  score: number | null;
  status: "new" | "contacted" | "call_booked" | "won" | "lost";
  notes: string;
}

export interface JobDoc extends Base {
  type: string;
  payload: Record<string, unknown>;
  status: "queued" | "running" | "done" | "failed";
  runAt: Date;
  attempts: number;
  maxAttempts: number;
  dedupeKey: string | null;
  lockedAt?: Date;
  finishedAt?: Date;
  lastError: string;
  result: unknown;
}

export interface ActivityDoc extends Base {
  clientId: Id;
  kind: "tracking" | "audit" | "fix" | "content" | "offsite" | "account" | "traffic";
  message: string;
  link: string;
}
