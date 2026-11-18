import mongoose, { type Model, type Types } from "mongoose";
// Default-export access: Mongoose 9's ESM build doesn't expose these as named exports under plain Node.
const { Schema: MSchema, model, models } = mongoose;
type MSchema = mongoose.Schema;
import type * as T from "./types";
export type * from "./types";

/**
 * Schemas are declared untyped (definition cast to any) and paired with explicit interfaces below.
 * Mongoose's InferSchemaType on schemas this size exhausts the TypeScript compiler.
 */
const S = (def: Record<string, unknown>, o?: Record<string, unknown>) => new MSchema(def as any, o as any);

/* Helper: register a model once (Next.js hot reload safe). */
// Non-generic on purpose: a generic Model<T> helper sends Mongoose 9's types into a compiler OOM.
const reg = (name: string, schema: MSchema): unknown => models[name] ?? model(name, schema);
const { ObjectId } = MSchema.Types;
const opts = { timestamps: true } as const;

/* ─────────────── Users ─────────────── */
const UserSchema = S(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, default: "" },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["client", "admin"], default: "client" },
    clientId: { type: ObjectId, ref: "Client", default: null },
    lastLoginAt: Date,
    googleId: { type: String, default: "" },
  },
  opts,
);
export const User = reg("User", UserSchema) as Model<T.UserDoc>;

/* ─────────────── Clients (one workspace per paying business) ─────────────── */
const CompetitorSchema = S(
  { name: { type: String, required: true }, domain: { type: String, default: "" }, aliases: { type: [String], default: [] } },
  { _id: false },
);
const RoadmapItemSchema = S(
  { month: Number, area: String, title: String, detail: String, done: { type: Boolean, default: false } },
  { _id: false },
);
const ClientSchema = S(
  {
    name: { type: String, required: true },
    website: { type: String, default: "" },
    domain: { type: String, default: "", index: true },
    category: { type: String, default: "" },
    description: { type: String, default: "" },
    location: { type: String, default: "" },
    audience: { type: String, default: "" },
    aliases: { type: [String], default: [] },
    competitors: { type: [CompetitorSchema], default: [] },
    plan: { type: String, enum: ["starter", "growth", "scale", null], default: null },
    status: { type: String, enum: ["onboarding", "active", "past_due", "canceled"], default: "onboarding", index: true },
    stripeCustomerId: { type: String, default: "", index: true },
    stripeSubscriptionId: { type: String, default: "" },
    currentPeriodEnd: Date,
    onboardedAt: Date,
    roadmap: {
      generatedAt: Date,
      summary: { type: String, default: "" },
      items: { type: [RoadmapItemSchema], default: [] },
    },
    integrations: {
      google: {
        refreshToken: { type: String, default: "" },
        email: { type: String, default: "" },
        gscSite: { type: String, default: "" },
        ga4Property: { type: String, default: "" },
        connectedAt: Date,
      },
      wordpress: {
        url: { type: String, default: "" },
        username: { type: String, default: "" },
        appPassword: { type: String, default: "" },
      },
    },
    lastTrackedAt: Date,
    lastAuditAt: Date,
    lastContentPlanMonth: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  opts,
);
export const Client = reg("Client", ClientSchema) as Model<T.ClientDoc>;

/* ─────────────── Buyer questions ─────────────── */
const QuestionSchema = S(
  {
    clientId: { type: ObjectId, ref: "Client", required: true, index: true },
    text: { type: String, required: true },
    intent: { type: String, enum: ["discovery", "comparison", "problem", "local", "brand"], default: "discovery" },
    active: { type: Boolean, default: true },
  },
  opts,
);
export const Question = reg("Question", QuestionSchema) as Model<T.QuestionDoc>;

/* ─────────────── Tracking: one row per (question, engine, sample, day) ─────────────── */
const TrackingResultSchema = S(
  {
    clientId: { type: ObjectId, ref: "Client", required: true },
    questionId: { type: ObjectId, ref: "Question", required: true },
    runId: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD (UTC)
    engine: { type: String, required: true },
    answer: { type: String, default: "" },
    mentioned: { type: Boolean, default: false },
    position: { type: Number, default: null },
    brandsRanked: { type: [String], default: [] },
    competitorMentions: { type: [{ name: String, position: Number, _id: false }], default: [] },
    cited: { type: Boolean, default: false },
    citations: { type: [String], default: [] },
    sentiment: { type: String, enum: ["positive", "neutral", "negative", null], default: null },
    error: { type: String, default: "" },
    empty: { type: Boolean, default: false }, // engine showed no answer block (e.g. no AI Overview)
  },
  opts,
);
TrackingResultSchema.index({ clientId: 1, date: -1 });
TrackingResultSchema.index({ clientId: 1, questionId: 1, date: -1 });
export const TrackingResult = reg("TrackingResult", TrackingResultSchema) as Model<T.TrackingResultDoc>;

/* ─────────────── Daily metric snapshot per client ─────────────── */
const SnapshotSchema = S(
  {
    clientId: { type: ObjectId, ref: "Client", required: true },
    date: { type: String, required: true },
    runId: { type: String, default: "" },
    score: Number,
    visibility: Number, // 0..1 share of answers that name the brand
    citationRate: Number, // 0..1 share of answers that cite the brand's domain
    avgPosition: { type: Number, default: null },
    shareOfVoice: Number, // 0..1 brand mentions / all tracked-brand mentions
    answers: Number,
    byEngine: { type: MSchema.Types.Mixed, default: {} }, // { [engine]: { visibility, answers, citationRate } }
    competitors: { type: [{ name: String, visibility: Number, shareOfVoice: Number, _id: false }], default: [] },
  },
  opts,
);
SnapshotSchema.index({ clientId: 1, date: 1 }, { unique: true });
export const Snapshot = reg("Snapshot", SnapshotSchema) as Model<T.SnapshotDoc>;

/* ─────────────── Audits + fixes ─────────────── */
const CheckSchema = S(
  {
    id: String,
    title: String,
    area: String,
    status: { type: String, enum: ["pass", "warn", "fail"] },
    detail: String,
    page: { type: String, default: "" },
  },
  { _id: false },
);
const AuditSchema = S(
  {
    clientId: { type: ObjectId, ref: "Client", index: true, default: null },
    url: String,
    score: Number,
    pagesScanned: Number,
    checks: { type: [CheckSchema], default: [] },
    aiBots: { type: MSchema.Types.Mixed, default: {} },
    source: { type: String, default: "native" },
  },
  opts,
);
export const Audit = reg("Audit", AuditSchema) as Model<T.AuditDoc>;

const FixSchema = S(
  {
    clientId: { type: ObjectId, ref: "Client", required: true, index: true },
    auditId: { type: ObjectId, ref: "Audit" },
    key: { type: String, required: true }, // stable id so re-audits don't duplicate
    title: String,
    detail: String,
    area: { type: String, enum: ["ai-access", "technical", "schema", "content", "offsite"], default: "technical" },
    impact: { type: String, enum: ["high", "medium", "low"], default: "medium" },
    page: { type: String, default: "" },
    owner: { type: String, enum: ["bayclusterlab", "client"], default: "bayclusterlab" },
    status: { type: String, enum: ["open", "in_progress", "done", "wont_fix"], default: "open" },
    doneAt: Date,
  },
  opts,
);
FixSchema.index({ clientId: 1, key: 1 }, { unique: true });
export const Fix = reg("Fix", FixSchema) as Model<T.FixDoc>;

/* ─────────────── Content pipeline ─────────────── */
export const CONTENT_STATUSES = ["planned", "drafting", "review", "client_review", "approved", "published", "rejected"] as const;
const ContentSchema = S(
  {
    clientId: { type: ObjectId, ref: "Client", required: true, index: true },
    type: { type: String, enum: ["blog", "money_page", "refresh"], default: "blog" },
    month: { type: String, required: true }, // YYYY-MM quota bucket
    title: { type: String, required: true },
    slug: { type: String, default: "" },
    targetQuestion: { type: String, default: "" },
    keywords: { type: [String], default: [] },
    brief: { type: String, default: "" },
    body: { type: String, default: "" }, // markdown
    metaDescription: { type: String, default: "" },
    faq: { type: [{ q: String, a: String, _id: false }], default: [] },
    sourceUrl: { type: String, default: "" }, // for refreshes
    status: { type: String, enum: CONTENT_STATUSES, default: "planned", index: true },
    reviewNotes: { type: String, default: "" },
    reviewedBy: { type: String, default: "" },
    wordCount: { type: Number, default: 0 },
    publishedUrl: { type: String, default: "" },
    wpPostId: { type: Number, default: null },
    publishedAt: Date,
  },
  opts,
);
export const Content = reg("Content", ContentSchema) as Model<T.ContentDoc>;

/* ─────────────── Off-site opportunities (Scale) ─────────────── */
const OpportunitySchema = S(
  {
    clientId: { type: ObjectId, ref: "Client", required: true, index: true },
    type: { type: String, enum: ["reddit", "quora", "directory", "publisher", "review"], required: true },
    title: String,
    url: { type: String, required: true },
    snippet: { type: String, default: "" },
    question: { type: String, default: "" },
    score: { type: Number, default: 0 },
    status: { type: String, enum: ["new", "in_progress", "done", "skipped"], default: "new" },
  },
  opts,
);
OpportunitySchema.index({ clientId: 1, url: 1 }, { unique: true });
export const Opportunity = reg("Opportunity", OpportunitySchema) as Model<T.OpportunityDoc>;

/* ─────────────── Traffic (Search Console + GA4), one row per day ─────────────── */
const TrafficSchema = S(
  {
    clientId: { type: ObjectId, ref: "Client", required: true },
    date: { type: String, required: true },
    clicks: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    position: { type: Number, default: null },
    sessions: { type: Number, default: 0 },
    aiSessions: { type: Number, default: 0 },
    aiBySource: { type: MSchema.Types.Mixed, default: {} },
    conversions: { type: Number, default: 0 },
    aiConversions: { type: Number, default: 0 },
  },
  opts,
);
TrafficSchema.index({ clientId: 1, date: 1 }, { unique: true });
export const Traffic = reg("Traffic", TrafficSchema) as Model<T.TrafficDoc>;

/* ─────────────── Free AI visibility check (lead magnet) ─────────────── */
const FreeCheckSchema = S(
  {
    url: { type: String, required: true },
    domain: { type: String, required: true, index: true },
    status: { type: String, enum: ["queued", "running", "done", "failed"], default: "queued" },
    step: { type: String, default: "Queued" },
    progress: { type: Number, default: 0 },
    brand: { type: String, default: "" },
    category: { type: String, default: "" },
    location: { type: String, default: "" },
    summary: { type: String, default: "" },
    engines: { type: [String], default: [] },
    questions: { type: [String], default: [] },
    results: {
      type: [
        {
          question: String,
          engine: String,
          mentioned: Boolean,
          position: Number,
          brandsRanked: [String],
          citations: [String],
          excerpt: String,
          _id: false,
        },
      ],
      default: [],
    },
    score: { type: Number, default: 0 },
    visibility: { type: Number, default: 0 },
    rivals: { type: [{ name: String, count: Number, _id: false }], default: [] },
    checks: { type: [CheckSchema], default: [] },
    readiness: { type: Number, default: 0 },
    email: { type: String, default: "" },
    unlocked: { type: Boolean, default: false },
    ip: { type: String, default: "" },
    error: { type: String, default: "" },
  },
  opts,
);
export const FreeCheck = reg("FreeCheck", FreeCheckSchema) as Model<T.FreeCheckDoc>;

/* ─────────────── Leads ─────────────── */
const LeadSchema = S(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    domain: { type: String, default: "" },
    name: { type: String, default: "" },
    source: { type: String, default: "free-check" },
    checkId: { type: ObjectId, ref: "FreeCheck" },
    score: { type: Number, default: null },
    status: { type: String, enum: ["new", "contacted", "call_booked", "won", "lost"], default: "new" },
    notes: { type: String, default: "" },
  },
  opts,
);
LeadSchema.index({ email: 1, domain: 1 }, { unique: true });
export const Lead = reg("Lead", LeadSchema) as Model<T.LeadDoc>;

/* ─────────────── Job queue (processed by src/worker) ─────────────── */
const JobSchema = S(
  {
    type: { type: String, required: true },
    payload: { type: MSchema.Types.Mixed, default: {} },
    status: { type: String, enum: ["queued", "running", "done", "failed"], default: "queued" },
    runAt: { type: Date, default: () => new Date() },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    dedupeKey: { type: String, default: null },
    lockedAt: Date,
    finishedAt: Date,
    lastError: { type: String, default: "" },
    result: { type: MSchema.Types.Mixed, default: null },
  },
  opts,
);
JobSchema.index({ status: 1, runAt: 1 });
JobSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" }, status: { $in: ["queued", "running"] } } },
);
export const Job = reg("Job", JobSchema) as Model<T.JobDoc>;

/* ─────────────── Activity feed (the "work done" story clients see) ─────────────── */
const ActivitySchema = S(
  {
    clientId: { type: ObjectId, ref: "Client", required: true, index: true },
    kind: { type: String, enum: ["tracking", "audit", "fix", "content", "offsite", "account", "traffic"], required: true },
    message: { type: String, required: true },
    link: { type: String, default: "" },
  },
  opts,
);
export const Activity = reg("Activity", ActivitySchema) as Model<T.ActivityDoc>;

export async function logActivity(clientId: Types.ObjectId | string, kind: T.ActivityDoc["kind"], message: string, link = "") {
  await Activity.create({ clientId: new mongoose.Types.ObjectId(String(clientId)), kind, message, link });
}
