import type { ContentStatus } from "./types";

export const TYPE_LABEL: Record<string, string> = { blog: "Article", money_page: "Money page", refresh: "Page improvement" };

/** How each internal status reads to a client. */
export const CLIENT_STATUS: Record<ContentStatus, { label: string; tone: "neutral" | "info" | "warn" | "good" | "lime" | "bad" }> = {
  planned: { label: "Planned", tone: "neutral" },
  drafting: { label: "Writing", tone: "info" },
  review: { label: "With our editors", tone: "info" },
  client_review: { label: "Needs your approval", tone: "warn" },
  approved: { label: "Approved", tone: "lime" },
  published: { label: "Published", tone: "good" },
  rejected: { label: "Dropped", tone: "bad" },
};
