/**
 * Visibility metrics. All rates are 0..1. "Answers" excludes engine errors and
 * empty answers (e.g. Google showed no AI Overview), so they don't drag scores down.
 */
export interface ResultRow {
  engine: string;
  mentioned: boolean;
  position: number | null;
  cited: boolean;
  competitorMentions: { name: string; position: number }[];
  error?: string;
  empty?: boolean;
}

/** How much a given list position is worth (1st place is full credit). */
export const positionWeight = (p: number | null) => (p == null ? 0 : p <= 1 ? 1 : p === 2 ? 0.8 : p === 3 ? 0.65 : p <= 5 ? 0.5 : 0.35);

export function computeMetrics(rows: ResultRow[], competitorNames: string[]) {
  const valid = rows.filter((r) => !r.error && !r.empty);
  const n = valid.length;
  const mentioned = valid.filter((r) => r.mentioned);
  const visibility = n ? mentioned.length / n : 0;
  const citationRate = n ? valid.filter((r) => r.cited).length / n : 0;
  const avgPosition = mentioned.length ? mentioned.reduce((s, r) => s + (r.position ?? 0), 0) / mentioned.length : null;
  const positionScore = n ? valid.reduce((s, r) => s + positionWeight(r.mentioned ? r.position : null), 0) / n : 0;

  const compCounts = Object.fromEntries(competitorNames.map((c) => [c, 0]));
  for (const r of valid) for (const c of r.competitorMentions) if (c.name in compCounts) compCounts[c.name]++;
  const totalMentions = mentioned.length + Object.values(compCounts).reduce((a, b) => a + b, 0);
  const shareOfVoice = totalMentions ? mentioned.length / totalMentions : 0;

  const byEngine: Record<string, { visibility: number; answers: number; citationRate: number }> = {};
  for (const r of valid) {
    const e = (byEngine[r.engine] ??= { visibility: 0, answers: 0, citationRate: 0 });
    e.answers++;
    if (r.mentioned) e.visibility++;
    if (r.cited) e.citationRate++;
  }
  for (const e of Object.values(byEngine)) {
    e.visibility = e.answers ? e.visibility / e.answers : 0;
    e.citationRate = e.answers ? e.citationRate / e.answers : 0;
  }

  const competitors = competitorNames.map((name) => ({
    name,
    visibility: n ? compCounts[name] / n : 0,
    shareOfVoice: totalMentions ? compCounts[name] / totalMentions : 0,
  }));

  // Headline score 0–100: mostly "are you named", then "how high", then "are you cited".
  const score = Math.round(100 * (0.55 * visibility + 0.25 * positionScore + 0.2 * citationRate));

  return { score, visibility, citationRate, avgPosition, shareOfVoice, answers: n, byEngine, competitors };
}

export const scoreBand = (s: number) =>
  s >= 70 ? { label: "Strong", tone: "good" as const } : s >= 40 ? { label: "Emerging", tone: "warn" as const } : { label: "Invisible", tone: "bad" as const };
