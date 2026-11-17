// Sample comics for building and testing the public pages before the admin
// dashboard exists. Every demo comic's slug starts with "demo-".
//
//   npm run demo:add      add the 12 demo comics (chapters, genres, views)
//   npm run demo:remove   delete every demo comic (and its chapters, views...)
//
// Remove the demo data before launch.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secretKey) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.");
  process.exit(1);
}
const db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const mode = process.argv[2];

const COMICS = [
  { slug: "the-ninth-gate-warden", title: "The Ninth Gate Warden", alt: ["아홉 번째 문지기", "Warden of the Ninth Gate"], genres: ["action", "fantasy"], status: "ongoing", latest: 48, hoursAgo: 2, featured: true, synopsis: "For three hundred years, the Ninth Gate has held because one warden never left his post. When he wakes from a sealed sleep, all eight gates before his own have fallen, and something is already climbing the stairs." },
  { slug: "ashen-crown", title: "Ashen Crown", alt: [], genres: ["fantasy", "drama"], status: "ongoing", latest: 112, hoursAgo: 5, featured: true, synopsis: "The youngest heir burns down the palace to escape a curse, then has to rule the kingdom that rises from the ashes." },
  { slug: "moonlit-apothecary", title: "Moonlit Apothecary", alt: [], genres: ["romance", "fantasy"], status: "ongoing", latest: 37, hoursAgo: 26, featured: true, synopsis: "A night-shift herbalist keeps treating a patient who only appears during a full moon, and never with the same face." },
  { slug: "tower-of-quiet-steel", title: "Tower of Quiet Steel", alt: [], genres: ["action", "martial-arts"], status: "completed", latest: 203, hoursAgo: 24 * 40, synopsis: "A swordsmith climbs a tower where every floor is guarded by a weapon he once forged." },
  { slug: "second-life-swordsmith", title: "Second Life Swordsmith", alt: [], genres: ["action", "reincarnation"], status: "ongoing", latest: 76, hoursAgo: 30, synopsis: "Reborn ten years before the war, a blacksmith decides to arm the side that lost." },
  { slug: "crimson-lotus-pact", title: "Crimson Lotus Pact", alt: [], genres: ["martial-arts", "drama"], status: "hiatus", latest: 64, hoursAgo: 24 * 21, synopsis: "Two rival sects sign a truce written in blood, and the only witness is a disciple who can't keep secrets." },
  { slug: "paper-dragon-cafe", title: "Paper Dragon Café", alt: [], genres: ["comedy", "slice-of-life"], status: "ongoing", latest: 29, hoursAgo: 52, synopsis: "A retired dragon opens a café and keeps setting the menu on fire." },
  { slug: "starfall-academy", title: "Starfall Academy", alt: [], genres: ["fantasy", "school"], status: "ongoing", latest: 91, hoursAgo: 60, synopsis: "At a school for future knights, the worst student is the only one who can see falling stars before they land." },
  { slug: "iron-saints-return", title: "Iron Saint's Return", alt: [], genres: ["action", "fantasy"], status: "ongoing", latest: 58, hoursAgo: 80, synopsis: "A saint thought dead for a century walks back into the church that canonised him, and he is not pleased." },
  { slug: "the-last-cartographer", title: "The Last Cartographer", alt: [], genres: ["adventure", "mystery"], status: "completed", latest: 140, hoursAgo: 24 * 90, synopsis: "Every map she draws becomes true. She has one blank page left." },
  { slug: "velvet-hour", title: "Velvet Hour", alt: [], genres: ["romance", "drama"], status: "ongoing", latest: 22, hoursAgo: 100, synopsis: "A jazz club opens for one hour each night, and the same stranger always takes the corner table." },
  { slug: "grave-bloom", title: "Grave Bloom", alt: [], genres: ["horror", "thriller"], status: "ongoing", latest: 15, hoursAgo: 120, synopsis: "Flowers grow on the graves of people who were murdered. This spring, the cemetery is in full bloom." },
];

async function add() {
  const { count } = await db.from("comics").select("id", { count: "exact", head: true }).like("slug", "demo-%");
  if (count) {
    console.error(`${count} demo comics already exist. Run npm run demo:remove first.`);
    process.exit(1);
  }

  const { data: genres, error: gErr } = await db.from("genres").select("id, slug");
  if (gErr) throw gErr;
  const genreId = Object.fromEntries(genres.map((g) => [g.slug, g.id]));

  const hour = 3600 * 1000;
  const now = Date.now();

  const { data: comics, error: cErr } = await db
    .from("comics")
    .insert(
      COMICS.map((c, i) => ({
        slug: `demo-${c.slug}`,
        title: c.title,
        alt_titles: c.alt,
        synopsis: c.synopsis,
        author: "Demo Author",
        artist: "Demo Artist",
        status: c.status,
        type: "manhwa",
        release_year: 2026,
        is_published: true,
        is_featured: Boolean(c.featured),
        // Stagger creation so "Recently added" has an order.
        created_at: new Date(now - i * 26 * hour).toISOString(),
      })),
    )
    .select("id, slug");
  if (cErr) throw cErr;
  const idOf = Object.fromEntries(comics.map((c) => [c.slug, c.id]));

  const comicGenres = COMICS.flatMap((c) =>
    c.genres.map((g) => ({ comic_id: idOf[`demo-${c.slug}`], genre_id: genreId[g] })),
  );
  const { error: cgErr } = await db.from("comic_genres").insert(comicGenres);
  if (cgErr) throw cgErr;

  // Last 12 chapters of each comic, one per week, newest first.
  // Two comics also get a chapter scheduled for next week (must stay hidden).
  const chapters = [];
  COMICS.forEach((c, i) => {
    const comicId = idOf[`demo-${c.slug}`];
    for (let k = 0; k < 12 && c.latest - k >= 1; k++) {
      chapters.push({
        comic_id: comicId,
        number: c.latest - k,
        status: "published",
        published_at: new Date(now - (c.hoursAgo + k * 24 * 7) * hour).toISOString(),
      });
    }
    if (i < 2) {
      chapters.push({
        comic_id: comicId,
        number: c.latest + 1,
        title: "Scheduled (should not be visible yet)",
        status: "published",
        published_at: new Date(now + 24 * 7 * hour).toISOString(),
      });
    }
  });
  const { error: chErr } = await db.from("chapters").insert(chapters);
  if (chErr) throw chErr;

  // 30 days of made-up views, different per comic, so Popular and Trending differ.
  const views = [];
  COMICS.forEach((c, i) => {
    for (let d = 0; d < 30; d++) {
      const recentBoost = d < 7 ? (i % 4) * 40 : 0;
      const base = 20 + ((i * 37 + d * 11) % 90) + recentBoost;
      views.push({
        comic_id: idOf[`demo-${c.slug}`],
        day: new Date(now - d * 24 * hour).toISOString().slice(0, 10),
        views: base,
      });
    }
  });
  const { error: vErr } = await db.from("comic_views_daily").insert(views);
  if (vErr) throw vErr;

  console.log(`Added ${comics.length} demo comics, ${chapters.length} chapters, ${views.length} daily view rows.`);
}

async function remove() {
  const { data, error } = await db.from("comics").delete().like("slug", "demo-%").select("id");
  if (error) throw error;
  console.log(`Removed ${data.length} demo comics (their chapters, genres links and views went with them).`);
}

try {
  if (mode === "add") await add();
  else if (mode === "remove") await remove();
  else {
    console.error("Usage: node scripts/demo-data.mjs add|remove");
    process.exit(1);
  }
} catch (err) {
  console.error(`Failed: ${err.message ?? err}`);
  process.exit(1);
}
