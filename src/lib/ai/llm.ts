import { env } from "../env";
import { postJson } from "./http";

/**
 * Internal "work" model used for planning, extraction and drafting (not for tracking).
 * Prefers Claude, falls back to OpenAI, then Gemini — whichever key is configured.
 */
export interface GenOpts {
  system?: string;
  maxTokens?: number;
  fast?: boolean; // use the cheap model
  temperature?: number;
}

export function llmAvailable() {
  return Boolean(env.anthropicKey() || env.openaiKey() || env.geminiKey());
}

export async function generate(prompt: string, o: GenOpts = {}): Promise<string> {
  const maxTokens = o.maxTokens ?? 2000;
  if (env.anthropicKey()) {
    const r = await postJson(
      "https://api.anthropic.com/v1/messages",
      {
        model: o.fast ? env.anthropicFastModel() : env.anthropicWorkModel(),
        max_tokens: maxTokens,
        // Current Claude models reject `temperature`; they manage sampling themselves.
        ...(o.system ? { system: o.system } : {}),
        messages: [{ role: "user", content: prompt }],
      },
      { "x-api-key": env.anthropicKey(), "anthropic-version": "2023-06-01" },
      { timeoutMs: 180_000 },
    );
    return (r.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");
  }
  if (env.openaiKey()) {
    const r = await postJson(
      "https://api.openai.com/v1/chat/completions",
      {
        model: env.openaiModel(),
        max_tokens: maxTokens,
        temperature: o.temperature ?? 0.4,
        messages: [...(o.system ? [{ role: "system", content: o.system }] : []), { role: "user", content: prompt }],
      },
      { authorization: `Bearer ${env.openaiKey()}` },
      { timeoutMs: 180_000 },
    );
    return r.choices?.[0]?.message?.content ?? "";
  }
  if (env.geminiKey()) {
    const r = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel()}:generateContent?key=${env.geminiKey()}`,
      {
        ...(o.system ? { systemInstruction: { parts: [{ text: o.system }] } } : {}),
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: o.temperature ?? 0.4 },
      },
      {},
      { timeoutMs: 180_000 },
    );
    return (r.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
  }
  throw new Error("No LLM configured — set ANTHROPIC_API_KEY (preferred), OPENAI_API_KEY or GEMINI_API_KEY");
}

/** Ask for JSON and parse the first object/array in the reply. */
export async function generateJson<T>(prompt: string, o: GenOpts = {}): Promise<T> {
  const text = await generate(`${prompt}\n\nRespond with JSON only. No prose, no code fences.`, { temperature: 0.2, ...o });
  return parseJsonLoose<T>(text);
}

export function parseJsonLoose<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start < 0) throw new Error("Model did not return JSON");
  const open = cleaned[start];
  const close = open === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(close);
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
