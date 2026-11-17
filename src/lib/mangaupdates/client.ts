import "server-only";

// Talks to the official, public MangaUpdates API (https://api.mangaupdates.com/v1).
// The endpoints used here need no account or key (verified in their OpenAPI
// spec). Their Acceptable Use Policy asks for "reasonable spacing between
// requests", so every request from this server waits until at least one second
// has passed since the previous one.

const BASE_URL = "https://api.mangaupdates.com/v1";
const MIN_GAP_MS = 1000;
const TIMEOUT_MS = 10_000;

export class MangaUpdatesError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MangaUpdatesError";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One queue for the whole server process: requests go out one at a time.
let queue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;
function waitForTurn(): Promise<void> {
  const turn = queue.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
  });
  queue = turn.catch(() => {});
  return turn;
}

// Returns the parsed JSON, or null for "not found". Throws MangaUpdatesError
// with a message an admin can act on for anything else.
export async function mangaUpdatesRequest(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<unknown | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await waitForTurn();

    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        method: options.method ?? "GET",
        headers: { "Content-Type": "application/json", "User-Agent": "IsfridVerse-metadata/1.0" },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      if (attempt === 1) continue;
      throw new MangaUpdatesError("MangaUpdates didn't respond. Check your connection and try again in a minute.");
    }

    if (res.status === 404) return null;

    if (res.status === 429 || res.status >= 500) {
      if (attempt === 1) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Math.min((retryAfter > 0 ? retryAfter : 2) * 1000, 10_000));
        continue;
      }
      throw new MangaUpdatesError(
        res.status === 429
          ? "MangaUpdates is limiting requests right now. Wait a minute and try again."
          : "MangaUpdates is having problems right now. Try again later.",
        res.status,
      );
    }

    if (!res.ok) throw new MangaUpdatesError(`MangaUpdates rejected the request (HTTP ${res.status}).`, res.status);

    try {
      return await res.json();
    } catch {
      throw new MangaUpdatesError("MangaUpdates sent a response that couldn't be read.");
    }
  }
  throw new MangaUpdatesError("MangaUpdates request failed.");
}
