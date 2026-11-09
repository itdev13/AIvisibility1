/** fetch + JSON with timeout, retries on 429/5xx, and readable errors. */
export async function postJson<T = any>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  { timeoutMs = 90_000, retries = 2 }: { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        const err = new HttpError(res.status, text.slice(0, 500));
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
          continue;
        }
        throw err;
      }
      return (text ? JSON.parse(text) : {}) as T;
    } catch (e) {
      lastErr = e;
      if (e instanceof HttpError) throw e;
      if (attempt >= retries) break;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`HTTP ${status}: ${body}`);
  }
}
