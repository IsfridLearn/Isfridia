import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { collectSnapshots } from "@/lib/mangadex/stats";
import { createServiceClient } from "@/lib/supabase/service";

// GET /api/cron/mangadex-stats
// Called once a day by Vercel Cron (vercel.json). Saves today's MangaDex
// follower/rating snapshot for every catalog title, then marks the cached
// "Trending This Week" data stale so the homepage picks up the new ranking.
//
// Vercel sends "Authorization: Bearer <CRON_SECRET>". Without CRON_SECRET set,
// the route refuses everything (fails closed).

// ~1,200 titles take about 70 s (MangaDex's statistics endpoint is slow);
// 300 s is the Hobby plan's ceiling and leaves room for catalog growth.
export const maxDuration = 300;

function authorised(header: string | null, secret: string): boolean {
  const given = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (!authorised(request.headers.get("authorization"), secret)) return new Response(null, { status: 401 });

  try {
    const result = await collectSnapshots(createServiceClient());
    revalidateTag("trending", "max");
    return Response.json(result);
  } catch (err) {
    console.error("mangadex-stats cron failed:", err);
    return Response.json({ error: "Snapshot failed; see the function logs" }, { status: 502 });
  }
}
