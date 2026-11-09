export type EngineId =
  | "chatgpt"
  | "gemini"
  | "perplexity"
  | "google"
  | "google_aio"
  | "ai_mode"
  | "copilot"
  | "grok"
  | "claude";

export interface EngineAnswer {
  text: string;
  citations: string[];
  /** For classic search: ranked result URLs (position = index + 1). */
  rankedUrls?: string[];
  /** Engine returned no answer block for this query (e.g. no AI Overview shown). */
  empty?: boolean;
}

export interface AskContext {
  location?: string;
}

export interface Engine {
  id: EngineId;
  label: string;
  short: string;
  /** Monogram colour for the engine chip (UI only). */
  tint: string;
  available: () => boolean;
  ask: (question: string, ctx: AskContext) => Promise<EngineAnswer>;
}

export const ENGINE_META: Record<EngineId, { label: string; short: string; tint: string }> = {
  claude: { label: "Claude", short: "Cl", tint: "#c96442" },
  chatgpt: { label: "ChatGPT", short: "GPT", tint: "#10a37f" },
  gemini: { label: "Gemini", short: "Gem", tint: "#4f7cff" },
  perplexity: { label: "Perplexity", short: "Px", tint: "#1f8a99" },
  google: { label: "Google Search", short: "G", tint: "#5f6368" },
  google_aio: { label: "AI Overviews", short: "AIO", tint: "#b06000" },
  ai_mode: { label: "AI Mode", short: "AIM", tint: "#8e44ad" },
  copilot: { label: "Copilot", short: "Co", tint: "#0067b8" },
  grok: { label: "Grok", short: "Gk", tint: "#222222" },
};
