import { createPublicClient } from "@/lib/supabase/public";

// GET /api/mangadex/cover/<mangadex id>/<file>.(256|512).jpg
//
// Serves a MangaDex cover thumbnail through our own server, because MangaDex
// refuses images embedded directly from its domain. Only covers of titles in
// OUR published catalog are served (so this can't be used as an open proxy).
// Cover file names never change, so browsers and the CDN keep them for a year
// and MangaDex is asked for each cover only once.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FILE = /^([0-9a-f-]{36}\.(?:jpg|jpeg|png|webp|gif))\.(256|512)\.jpg$/i;

export async function GET(_request: Request, ctx: RouteContext<"/api/mangadex/cover/[mangaId]/[file]">) {
  const { mangaId, file } = await ctx.params;
  const match = FILE.exec(file);
  if (!UUID.test(mangaId) || !match) return new Response("Not found", { status: 404 });

  // Must be the current cover of a published title we list.
  const { data } = await createPublicClient()
    .from("comic_cards")
    .select("id")
    .eq("mangadex_id", mangaId)
    .eq("cover_key", `md:${mangaId}/${match[1]}`)
    .maybeSingle();
  if (!data) return new Response("Not found", { status: 404 });

  let upstream: Response;
  try {
    upstream = await fetch(`https://uploads.mangadex.org/covers/${mangaId}/${file}`, {
      headers: { "User-Agent": "Isfridia/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return new Response("Cover unavailable", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return new Response("Cover unavailable", { status: 502 });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
