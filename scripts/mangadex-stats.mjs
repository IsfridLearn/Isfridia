// Saves today's MangaDex follower/rating snapshot for every catalog title (the
// data behind "Trending This Week"). On the live site Vercel Cron does this
// daily through /api/cron/mangadex-stats; run it by hand with:
//
//   npm run mangadex:stats
//
// Safe to re-run: the same day just refreshes that day's numbers.

import { createClient } from "@supabase/supabase-js";
import { collectSnapshots } from "../src/lib/mangadex/stats.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secretKey) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.");
  process.exit(1);
}
const db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

const started = Date.now();
const r = await collectSnapshots(db);
console.log(
  `Snapshot ${r.day}: ${r.saved}/${r.titles} titles saved, ${r.missing} without statistics, ` +
    `${r.pruned} old rows removed (${Math.round((Date.now() - started) / 1000)}s).`,
);
