// Polite MangaDex API client, shared by the catalog sync script and the daily
// statistics collector. Server-side only (MangaDex asks for no browser calls).
//
// Follows MangaDex's rules: at most ~4 requests per second (their limit is ~5),
// waits and retries on 429 / 5xx (honouring their retry headers), 20 s timeout.
// No network-free logic here; mapping lives in map.ts.

const API = "https://api.mangadex.org";
const MIN_GAP_MS = 260;
let last = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Params = [string, string][];

export async function mangadex<T>(path: string, params: Params = [], userAgent = "Isfridia/1.0"): Promise<T> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const wait = last + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    let res: Response;
    try {
      res = await fetch(`${API}${path}?${new URLSearchParams(params)}`, {
        headers: { "User-Agent": userAgent },
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      await sleep(2000 * attempt);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      const retryAfter =
        Number(res.headers.get("retry-after")) || Number(res.headers.get("x-ratelimit-retry-after")) - Date.now() / 1000;
      await sleep(Math.min(60_000, Math.max(2000, (retryAfter > 0 ? retryAfter : 2 * attempt) * 1000)));
      continue;
    }
    if (!res.ok) throw new Error(`MangaDex ${path} answered ${res.status}`);
    return (await res.json()) as T;
  }
  throw new Error(`MangaDex ${path}: gave up after retries`);
}
