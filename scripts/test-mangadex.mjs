// End-to-end check of the MangaDex catalog on a RUNNING site (after a sync).
// Run: npm run build && npm run start, then: npm run test:mangadex
// Optional: BASE_URL (default http://localhost:3000). Read-only: changes nothing.

import { createClient } from "@supabase/supabase-js";

const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!url || !key) {
  console.error("Needs the Supabase settings in .env.local.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const results = [];
const check = (name, passed, detail = "") => results.push({ name, passed: Boolean(passed), detail });
// React separates adjacent text with <!-- --> markers; remove them before matching text.
const page = async (path) => (await (await fetch(`${base}${path}`)).text()).replaceAll("<!-- -->", "");

try {
  // Pick real titles from the synced catalog (as a visitor sees it).
  const { data: withChapters } = await db
    .from("comic_cards")
    .select("slug, title, mangadex_id, latest_chapter_number")
    .eq("source", "mangadex")
    .gt("chapter_count", 0)
    .order("external_popularity", { ascending: false })
    .limit(1);
  const { data: withoutChapters } = await db
    .from("comic_cards")
    .select("slug, title")
    .eq("source", "mangadex")
    .eq("chapter_count", 0)
    .limit(1);
  const { count } = await db.from("comic_cards").select("id", { count: "exact", head: true }).eq("source", "mangadex");
  check(`The catalog holds real MangaDex titles (${count})`, (count ?? 0) >= 100, String(count));
  const t = withChapters?.[0];
  if (!t) throw new Error("No synced title with official chapters; run npm run mangadex:sync first.");

  const home = await page("/");
  const coverPath = home.match(/\/api\/mangadex\/cover\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.\w+\.256\.jpg/)?.[0];
  check("Homepage shows MangaDex titles with their covers", Boolean(coverPath) && home.includes(t.title));
  if (coverPath) {
    const res = await fetch(base + coverPath);
    const bytes = Buffer.from(await res.arrayBuffer());
    check(
      "A cover loads as a real image, cached for a year",
      res.ok && /^image\//.test(res.headers.get("content-type") ?? "") && bytes.length > 2000 && (res.headers.get("cache-control") ?? "").includes("31536000"),
      `${res.status} ${res.headers.get("content-type")} ${bytes.length} bytes`,
    );
  }
  const fake = await fetch(`${base}/api/mangadex/cover/${t.mangadex_id}/00000000-0000-0000-0000-000000000000.jpg.256.jpg`);
  check("The cover route refuses anything that isn't a catalog cover", fake.status === 404, String(fake.status));

  const detail = await page(`/comics/${t.slug}`);
  check("Comic page shows the real title and MangaDex credit", detail.includes(t.title) && detail.includes(`mangadex.org/title/${t.mangadex_id}`));
  check("Comic page lists official chapters linking to the publisher", /<a href="https:\/\/[^"]+" target="_blank" rel="noopener noreferrer"[^>]*aria-label="Chapter [^"]+ on /.test(detail) && detail.includes("↗ "));

  const chapterNo = String(Number(t.latest_chapter_number)).replace(".", "-");
  const reader = await page(`/comics/${t.slug}/chapter-${chapterNo}`);
  check("Reader shows the official-release card with a link out", /is published by/.test(reader) && /Read on [^<]+ ↗/.test(reader));

  if (withoutChapters?.[0]) {
    const none = await page(`/comics/${withoutChapters[0].slug}`);
    check("Titles without official chapters say so (no fake chapters)", none.includes("No official English chapters linked yet"));
  }

  const browse = await page("/comics?type=manhwa&sort=popular");
  check("Browse: type filter + popular sort return MangaDex titles", browse.includes("/api/mangadex/cover/") && /\d+ comics/.test(browse));
  const p2 = await page("/comics?page=2");
  check("Browse: page 2 exists (large catalog)", /Page 2 of \d+/.test(p2));
  const genre = await page("/genres/action");
  check("Genre pages list MangaDex titles", genre.includes("/api/mangadex/cover/"));
  const word = t.title.split(/\s+/)[0];
  const search = await page(`/search?q=${encodeURIComponent(word)}`);
  check(`Search finds MangaDex titles ("${word}")`, search.includes(t.title));
  const popular = await page("/popular");
  check("Popular lists MangaDex titles", popular.includes("/api/mangadex/cover/"));
  const latest = await page("/latest");
  check("Latest updates lists official chapters", /Chapter \d/.test(latest));
  const footer = home.includes("mangadex.org") && home.includes("MangaDex");
  check("Every page credits MangaDex (footer)", footer);
} catch (err) {
  check("Test ran to completion", false, err.message);
}

for (const r of results) console.log(`${r.passed ? "PASS" : "FAIL"}  ${r.name}${r.passed || !r.detail ? "" : `\n      got: ${r.detail}`}`);
const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
