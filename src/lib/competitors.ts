import type { Competitor } from "./types";
import { domainOf } from "./utils";

/** "Name, domain.com" per line → competitors. Domain is optional. */
export function parseCompetitors(raw: string): Competitor[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, domain] = l.split(/\s*,\s*|\s+[|—–]\s+/);
      return { name: (name ?? "").trim(), domain: domain ? domainOf(domain.trim()) : "", aliases: [] };
    })
    .filter((c) => c.name)
    .slice(0, 10);
}

export const formatCompetitors = (c: Competitor[]) => c.map((x) => (x.domain ? `${x.name}, ${x.domain}` : x.name)).join("\n");
