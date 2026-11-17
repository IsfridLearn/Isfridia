// Syncs the MangaDex catalog into Isfridia.
//
//   npm run mangadex:sync                          100 most-followed titles + their official chapters
//   npm run mangadex:sync -- --pages=10            1,000 titles (100 per page)
//   npm run mangadex:sync -- --order=latest        the most recently updated titles instead
//   npm run mangadex:sync -- --offset=1000         continue further down the list
//   npm run mangadex:sync -- --no-chapters         titles only
//   npm run mangadex:sync -- --verify              re-check every imported title; unpublish removed/adult ones
//
// Follows MangaDex's API rules: server-side only, at most ~4 requests per
// second (limit is ~5), backs off on 429, credits MangaDex on the site, no ads.
// Imports ONLY official chapters (external links to the publisher). Chapters
// hosted on MangaDex are fan scanlations and are never imported.
// Titles: safe/suggestive ratings only (the site has no age check).

import { createClient } from "@supabase/supabase-js";
import { slugify } from "../src/lib/admin/comic-form.ts";
import { mangadex } from "../src/lib/mangadex/api.ts";
import { ALLOWED_RATINGS, mapManga, officialChapters } from "../src/lib/mangadex/map.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secretKey) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.");
  process.exit(1);
}
const db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const PAGES = Math.max(1, Math.min(100, Number(args.pages ?? 1)));
const OFFSET = Math.max(0, Number(args.offset ?? 0));
const ORDER = args.order === "latest" ? "latestUploadedChapter" : "followedCount";
const WITH_CHAPTERS = args["no-chapters"] !== "true";

// ---- MangaDex API client (polite; shared with the statistics collector) --------

const md = (path, params = []) => mangadex(path, params, "Isfridia/1.0 (catalog sync)");

const RATINGS = [...ALLOWED_RATINGS].map((r) => ["contentRating[]", r]);

// ---- existing data --------------------------------------------------------------

async function loadAll(table, columns, filter = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(db.from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const genres = new Map((await loadAll("genres", "id, slug")).map((g) => [g.slug, g.id]));
async function genreId(name) {
  const slug = slugify(name);
  if (!slug) return null;
  if (!genres.has(slug)) {
    const { data, error } = await db.from("genres").insert({ slug, name: name.slice(0, 40) }).select("id").single();
    if (error) {
      const { data: again } = await db.from("genres").select("id").eq("slug", slug).maybeSingle();
      if (!again) return null;
      genres.set(slug, again.id);
    } else {
      genres.set(slug, data.id);
      console.log(`  + new genre: ${name}`);
    }
  }
  return genres.get(slug);
}

const comics = await loadAll("comics", "id, slug, mangadex_id");
const slugs = new Set(comics.map((c) => c.slug));
const byMdId = new Map(comics.filter((c) => c.mangadex_id).map((c) => [c.mangadex_id, c]));

function uniqueSlug(title, mdId) {
  const base = slugify(title) || `md-${mdId.slice(0, 8)}`;
  let slug = base;
  if (slugs.has(slug)) slug = `${base}-${mdId.slice(0, 6)}`.slice(0, 100);
  for (let i = 2; slugs.has(slug); i++) slug = `${base}-${mdId.slice(0, 6)}-${i}`.slice(0, 100);
  slugs.add(slug);
  return slug;
}

// ---- sync ---------------------------------------------------------------------------

const totals = { titles: 0, added: 0, updated: 0, skippedAdult: 0, chapters: 0, chaptersRemoved: 0, errors: 0 };

async function syncChapters(comicId, mdId) {
  const all = [];
  for (let offset = 0; ; offset += 500) {
    const page = await md(`/manga/${mdId}/feed`, [
      ["limit", "500"],
      ["offset", String(offset)],
      ["translatedLanguage[]", "en"],
      ["includeExternalUrl", "1"], // ONLY chapters that link to the official publisher
      ["includes[]", "scanlation_group"],
      ["order[chapter]", "asc"],
      ...RATINGS,
    ]);
    all.push(...page.data);
    if (offset + 500 >= page.total || offset + 500 >= 10_000) break;
  }
  const wanted = officialChapters(all);
  const wantedIds = new Set(wanted.map((c) => c.mangadex_id));

  // Honour removals: chapters MangaDex no longer lists disappear here too.
  const { data: existing } = await db.from("chapters").select("id, mangadex_id").eq("comic_id", comicId).not("mangadex_id", "is", null);
  const stale = (existing ?? []).filter((c) => !wantedIds.has(c.mangadex_id)).map((c) => c.id);
  if (stale.length) {
    await db.from("chapters").delete().in("id", stale);
    totals.chaptersRemoved += stale.length;
  }

  for (let i = 0; i < wanted.length; i += 200) {
    const rows = wanted.slice(i, i + 200).map((c) => ({ ...c, comic_id: comicId, status: "published" }));
    const { error } = await db.from("chapters").upsert(rows, { onConflict: "mangadex_id" });
    if (error) {
      // A number clash (rare): fall back to one by one and skip the clashing ones.
      for (const row of rows) {
        const { error: one } = await db.from("chapters").upsert(row, { onConflict: "mangadex_id" });
        if (one) totals.errors++;
      }
    }
  }
  totals.chapters += wanted.length;
  return wanted.length;
}

async function syncPage(offset) {
  const list = await md("/manga", [
    ["limit", "100"],
    ["offset", String(offset)],
    [`order[${ORDER}]`, "desc"],
    ["availableTranslatedLanguage[]", "en"],
    ["hasAvailableChapters", "true"],
    ["includes[]", "cover_art"],
    ...RATINGS,
  ]);
  if (!list.data.length) return false;

  const stats = await md("/statistics/manga", list.data.map((m) => ["manga[]", m.id]));
  const now = new Date().toISOString();

  for (const m of list.data) {
    totals.titles++;
    const mapped = mapManga(m);
    if (!mapped) {
      totals.skippedAdult++;
      continue;
    }
    const { genres: genreNames, themeSlugs, ...fields } = mapped;
    const row = {
      ...fields,
      external_popularity: stats.statistics?.[m.id]?.follows ?? 0,
      external_synced_at: now,
    };

    let comicId;
    const existing = byMdId.get(m.id);
    if (existing) {
      const { error } = await db.from("comics").update(row).eq("id", existing.id);
      if (error) {
        totals.errors++;
        continue;
      }
      comicId = existing.id;
      totals.updated++;
    } else {
      const { data, error } = await db
        .from("comics")
        .insert({ ...row, slug: uniqueSlug(mapped.title, m.id), source: "mangadex", is_published: true })
        .select("id, slug")
        .single();
      if (error) {
        totals.errors++;
        console.log(`  ! ${mapped.title}: ${error.message}`);
        continue;
      }
      comicId = data.id;
      byMdId.set(m.id, { id: data.id, slug: data.slug, mangadex_id: m.id });
      totals.added++;
    }

    const ids = new Set();
    for (const name of genreNames) {
      const id = await genreId(name);
      if (id) ids.add(id);
    }
    for (const slug of themeSlugs) if (genres.has(slug)) ids.add(genres.get(slug));
    await db.from("comic_genres").delete().eq("comic_id", comicId);
    if (ids.size) await db.from("comic_genres").insert([...ids].map((genre_id) => ({ comic_id: comicId, genre_id })));

    if (WITH_CHAPTERS) {
      try {
        await syncChapters(comicId, m.id);
      } catch (err) {
        totals.errors++;
        console.log(`  ! chapters for ${mapped.title}: ${err.message}`);
      }
    }
  }
  return true;
}

// Re-check every imported title: removed from MangaDex or now adult-rated -> unpublish.
async function verify() {
  const mine = await loadAll("comics", "id, mangadex_id, is_published", (q) => q.not("mangadex_id", "is", null));
  let unpublished = 0;
  for (let i = 0; i < mine.length; i += 100) {
    const batch = mine.slice(i, i + 100);
    const found = await md("/manga", [
      ["limit", "100"],
      ...batch.map((c) => ["ids[]", c.mangadex_id]),
      ...["safe", "suggestive", "erotica", "pornographic"].map((r) => ["contentRating[]", r]),
    ]);
    const ok = new Set(found.data.filter((m) => ALLOWED_RATINGS.has(m.attributes.contentRating)).map((m) => m.id));
    const gone = batch.filter((c) => c.is_published && !ok.has(c.mangadex_id)).map((c) => c.id);
    if (gone.length) {
      await db.from("comics").update({ is_published: false }).in("id", gone);
      unpublished += gone.length;
    }
  }
  console.log(`Verified ${mine.length} MangaDex titles; unpublished ${unpublished} (removed or adult).`);
}

const started = Date.now();
if (args.verify === "true") {
  await verify();
} else {
  for (let p = 0; p < PAGES; p++) {
    const offset = OFFSET + p * 100;
    if (offset + 100 > 10_000) break; // MangaDex lists stop at 10,000 results
    process.stdout.write(`Page ${p + 1}/${PAGES} (titles ${offset + 1}-${offset + 100})… `);
    const more = await syncPage(offset);
    console.log(`done: ${totals.added} added, ${totals.updated} updated, ${totals.chapters} official chapters so far`);
    if (!more) break;
  }
  console.log(
    `\nFinished in ${Math.round((Date.now() - started) / 1000)}s: ${totals.titles} titles seen, ${totals.added} added, ` +
      `${totals.updated} updated, ${totals.skippedAdult} skipped (adult), ${totals.chapters} official chapters, ` +
      `${totals.chaptersRemoved} removed, ${totals.errors} errors.`,
  );
}
