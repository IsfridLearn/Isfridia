// Proves the database security rules (Row Level Security) work.
// Run with: npm run test:rls   (after npm run db:push)
//
// It creates temporary test users and test comics, then tries things that
// must be allowed and things that must be blocked, as a visitor, as two
// different readers, and as an admin. Everything it created is deleted at the
// end, even if a check fails. Use it on the development project.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !publishableKey || !secretKey) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY in .env.local.");
  process.exit(1);
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
// The secret key bypasses RLS. Used ONLY to set up and clean up test data.
const service = createClient(url, secretKey, noSession);
const anon = createClient(url, publishableKey, noSession);

const run = Date.now().toString(36);
const results = [];
const check = (name, passed, detail = "") => results.push({ name, passed: Boolean(passed), detail });
const must = (label, { error }) => {
  if (error) throw new Error(`${label}: ${error.message}`);
};

const created = { users: [], comics: [], genres: [] };

async function makeUser(tag) {
  const email = `rls-${tag}-${run}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  const username = `t_${tag}_${run}`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) throw new Error(`create user ${tag}: ${error.message}`);
  created.users.push(data.user.id);
  const client = createClient(url, publishableKey, noSession);
  must(`sign in ${tag}`, await client.auth.signInWithPassword({ email, password }));
  return { id: data.user.id, username, client };
}

async function main() {
  // ---- Setup (as the service role) ----------------------------------------
  const a = await makeUser("a");
  const b = await makeUser("b");
  const admin = await makeUser("adm");
  must("grant admin", await service.from("admin_permissions").insert({ user_id: admin.id, role: "admin" }));

  const { data: comics, error: comicErr } = await service
    .from("comics")
    .insert([
      { slug: `rls-public-${run}`, title: "RLS test (published)", is_published: true },
      { slug: `rls-hidden-${run}`, title: "RLS test (unpublished)", is_published: false },
    ])
    .select("id, slug");
  if (comicErr) throw new Error(`create comics: ${comicErr.message}`);
  const pub = comics.find((c) => c.slug.startsWith("rls-public")).id;
  const hidden = comics.find((c) => c.slug.startsWith("rls-hidden")).id;
  created.comics.push(pub, hidden);

  const hour = 3600 * 1000;
  const { data: chapters, error: chapErr } = await service
    .from("chapters")
    .insert([
      { comic_id: pub, number: 1, status: "published", published_at: new Date(Date.now() - hour).toISOString() },
      { comic_id: pub, number: 2, status: "published", published_at: new Date(Date.now() + 24 * hour).toISOString() },
      { comic_id: pub, number: 3, status: "draft" },
      { comic_id: hidden, number: 1, status: "published", published_at: new Date(Date.now() - hour).toISOString() },
    ])
    .select("id, comic_id, number");
  if (chapErr) throw new Error(`create chapters: ${chapErr.message}`);
  const chap = (comic, n) => chapters.find((c) => c.comic_id === comic && Number(c.number) === n).id;
  const released = chap(pub, 1);
  const scheduled = chap(pub, 2);
  const draft = chap(pub, 3);
  const inHiddenComic = chap(hidden, 1);

  must(
    "create images",
    await service.from("chapter_images").insert([
      { chapter_id: released, position: 0, storage_key: `test/${run}/r0`, width: 800, height: 1200, bytes: 1000 },
      { chapter_id: scheduled, position: 0, storage_key: `test/${run}/s0`, width: 800, height: 1200, bytes: 1000 },
    ]),
  );

  const testIds = [pub, hidden];
  const testChapters = [released, scheduled, draft, inHiddenComic];

  // ---- Visitors (not logged in) -------------------------------------------
  {
    const { data } = await anon.from("comics").select("id").in("id", testIds);
    check("Visitor sees published comic, not unpublished one", data?.length === 1 && data[0].id === pub, JSON.stringify(data));

    const { data: ch } = await anon.from("chapters").select("id").in("id", testChapters);
    check(
      "Visitor sees only released chapters (not scheduled, draft, or in an unpublished comic)",
      ch?.length === 1 && ch[0].id === released,
      JSON.stringify(ch),
    );

    const { data: img } = await anon.from("chapter_images").select("chapter_id").in("chapter_id", [released, scheduled]);
    check("Visitor sees images of released chapters only", img?.length === 1 && img[0].chapter_id === released, JSON.stringify(img));

    const { error } = await anon.from("comics").insert({ slug: `rls-anon-${run}`, title: "nope" });
    check("Visitor cannot create a comic", Boolean(error), error?.message);

    const { data: isAdm } = await anon.rpc("is_admin");
    check("Visitor is not admin", isAdm === false, String(isAdm));

    const { data: cards } = await anon
      .from("comic_cards")
      .select("id, latest_chapter_number, chapter_count")
      .in("id", testIds);
    check("Comic cards list only the published comic", cards?.length === 1 && cards[0].id === pub, JSON.stringify(cards));
    check(
      "Comic card's latest chapter ignores scheduled and draft chapters",
      Number(cards?.[0]?.latest_chapter_number) === 1 && cards?.[0]?.chapter_count === 1,
      JSON.stringify(cards),
    );
  }

  // ---- Reader A: content is read-only ---------------------------------------
  {
    const { error: insErr } = await a.client.from("comics").insert({ slug: `rls-a-${run}`, title: "nope" });
    check("Reader cannot create a comic", Boolean(insErr), insErr?.message);

    const { data: upd } = await a.client.from("comics").update({ title: "hacked" }).eq("id", pub).select("id");
    check("Reader cannot edit a comic", (upd ?? []).length === 0, JSON.stringify(upd));

    const { data: del } = await a.client.from("comics").delete().eq("id", pub).select("id");
    check("Reader cannot delete a comic", (del ?? []).length === 0, JSON.stringify(del));

    const { error: gErr } = await a.client.from("genres").insert({ slug: `rls-${run}`, name: `RLS ${run}` });
    check("Reader cannot create a genre", Boolean(gErr), gErr?.message);

    const { error: chErr } = await a.client.from("chapters").insert({ comic_id: pub, number: 99 });
    check("Reader cannot create a chapter", Boolean(chErr), chErr?.message);

    const { error: apErr } = await a.client.from("admin_permissions").insert({ user_id: a.id, role: "admin" });
    check("Reader cannot make themselves admin", Boolean(apErr), apErr?.message);

    const { data: isAdm } = await a.client.rpc("is_admin");
    check("Reader is not admin", isAdm === false, String(isAdm));
  }

  // ---- Profiles ------------------------------------------------------------
  {
    const { data: prof } = await a.client.from("profiles").select("username").eq("id", a.id).single();
    check("Sign-up created a profile with the chosen username", prof?.username === a.username, JSON.stringify(prof));

    const { data: own } = await a.client.from("profiles").update({ display_name: "Reader A" }).eq("id", a.id).select("id");
    check("Reader can edit own profile", own?.length === 1, JSON.stringify(own));

    const { data: other } = await a.client.from("profiles").update({ display_name: "hacked" }).eq("id", b.id).select("id");
    check("Reader cannot edit another user's profile", (other ?? []).length === 0, JSON.stringify(other));

    const { error: colErr } = await a.client
      .from("profiles")
      .update({ created_at: new Date(0).toISOString() })
      .eq("id", a.id);
    check("Reader cannot change protected profile columns", Boolean(colErr), colErr?.message);
  }

  // ---- Bookmarks: private per user -----------------------------------------
  {
    const { error: okErr } = await a.client.from("bookmarks").insert({ user_id: a.id, comic_id: pub });
    check("Reader can bookmark a published comic", !okErr, okErr?.message);

    const { error: hidErr } = await a.client.from("bookmarks").insert({ user_id: a.id, comic_id: hidden });
    check("Reader cannot bookmark an unpublished comic", Boolean(hidErr), hidErr?.message);

    const { data: seen } = await b.client.from("bookmarks").select("user_id").eq("user_id", a.id);
    check("Reader B cannot see Reader A's bookmarks", (seen ?? []).length === 0, JSON.stringify(seen));

    const { data: delOther } = await b.client.from("bookmarks").delete().eq("user_id", a.id).select("user_id");
    check("Reader B cannot delete Reader A's bookmark", (delOther ?? []).length === 0, JSON.stringify(delOther));

    const { error: forgeErr } = await b.client.from("bookmarks").insert({ user_id: a.id, comic_id: pub, is_favorite: true });
    check("Reader B cannot add a bookmark as Reader A", Boolean(forgeErr), forgeErr?.message);

    const { data: still } = await service.from("bookmarks").select("user_id").eq("user_id", a.id);
    check("Reader A's bookmark is untouched", still?.length === 1, JSON.stringify(still));
  }

  // ---- Reading history -------------------------------------------------------
  {
    const { error: okErr } = await a.client
      .from("reading_history")
      .insert({ user_id: a.id, chapter_id: released, comic_id: hidden, progress: 0.4 });
    check("Reader can save progress on a released chapter", !okErr, okErr?.message);

    const { data: row } = await a.client.from("reading_history").select("comic_id").eq("chapter_id", released).single();
    check("History's comic is taken from the chapter, not the request", row?.comic_id === pub, JSON.stringify(row));

    const { error: schedErr } = await a.client
      .from("reading_history")
      .insert({ user_id: a.id, chapter_id: scheduled, comic_id: pub });
    check("Reader cannot save progress on a scheduled chapter", Boolean(schedErr), schedErr?.message);

    const { data: seen } = await b.client.from("reading_history").select("user_id").eq("user_id", a.id);
    check("Reader B cannot see Reader A's history", (seen ?? []).length === 0, JSON.stringify(seen));
  }

  // ---- Admin ------------------------------------------------------------------
  {
    const { data: isAdm } = await admin.client.rpc("is_admin");
    check("Admin is recognised as admin", isAdm === true, String(isAdm));

    const { data: all } = await admin.client.from("comics").select("id").in("id", testIds);
    check("Admin sees unpublished comics", all?.length === 2, JSON.stringify(all));

    const { data: allCh } = await admin.client.from("chapters").select("id").in("id", testChapters);
    check("Admin sees scheduled and draft chapters", allCh?.length === 4, JSON.stringify(allCh));

    const { data: g, error: gErr } = await admin.client
      .from("genres")
      .insert({ slug: `rls-${run}`, name: `RLS ${run}` })
      .select("id")
      .single();
    if (g) created.genres.push(g.id);
    check("Admin can create a genre", !gErr, gErr?.message);

    const { error: apErr } = await admin.client.from("admin_permissions").insert({ user_id: a.id, role: "admin" });
    check("Admin (not owner) cannot grant admin to others", Boolean(apErr), apErr?.message);

    const { data: seen } = await admin.client.from("bookmarks").select("user_id").eq("user_id", a.id);
    check("Admin cannot read readers' bookmarks (privacy)", (seen ?? []).length === 0, JSON.stringify(seen));
  }

  // ---- MangaUpdates cache: admins only ----------------------------------------
  {
    const key = `rls-test:${run}`;
    const expires = new Date(Date.now() + 3600 * 1000).toISOString();
    const { error: admWrite } = await admin.client
      .from("mangaupdates_cache")
      .insert({ cache_key: key, payload: { ok: true }, expires_at: expires });
    check("Admin can write the MangaUpdates cache", !admWrite, admWrite?.message);

    const { data: anonRead } = await anon.from("mangaupdates_cache").select("cache_key").eq("cache_key", key);
    check("Visitor cannot read the MangaUpdates cache", (anonRead ?? []).length === 0, JSON.stringify(anonRead));

    const { data: readerRead } = await a.client.from("mangaupdates_cache").select("cache_key").eq("cache_key", key);
    check("Reader cannot read the MangaUpdates cache", (readerRead ?? []).length === 0, JSON.stringify(readerRead));

    const { error: readerWrite } = await a.client
      .from("mangaupdates_cache")
      .insert({ cache_key: `${key}:reader`, payload: { poisoned: true }, expires_at: expires });
    check("Reader cannot write the MangaUpdates cache", Boolean(readerWrite), readerWrite?.message);

    await service.from("mangaupdates_cache").delete().like("cache_key", `rls-test:${run}%`);
  }

  // ---- Phase 6: audit log, genre setting, permanent deletion -----------------
  {
    const owner = await makeUser("own");
    must("grant owner", await service.from("admin_permissions").insert({ user_id: owner.id, role: "owner" }));

    const { data: upd } = await admin.client.from("comics").update({ title: `RLS edited ${run}` }).eq("id", pub).select("id");
    check("Admin can edit a comic", upd?.length === 1, JSON.stringify(upd));

    const { data: logRows } = await admin.client
      .from("audit_log")
      .select("actor_id, action, old_data, new_data")
      .eq("table_name", "comics")
      .eq("row_id", pub)
      .eq("action", "update")
      .order("created_at", { ascending: false })
      .limit(1);
    const entry = logRows?.[0];
    check(
      "The edit is in the audit log with who made it and the old title",
      entry?.actor_id === admin.id && entry?.old_data?.title === "RLS test (published)" && entry?.new_data?.title === `RLS edited ${run}`,
      JSON.stringify(entry),
    );

    const { data: readerLog } = await a.client.from("audit_log").select("id").limit(1);
    check("Reader cannot read the audit log", (readerLog ?? []).length === 0, JSON.stringify(readerLog));

    const { error: forgeLog } = await admin.client
      .from("audit_log")
      .insert({ action: "update", table_name: "comics", row_id: "x" });
    check("Nobody can write the audit log by hand", Boolean(forgeLog), forgeLog?.message);

    const { data: genreRows } = await service.from("genres").select("id").limit(2);
    const genreIds = (genreRows ?? []).map((g) => g.id);
    const { error: readerGenres } = await a.client.rpc("set_comic_genres", { p_comic_id: pub, p_genre_ids: genreIds });
    check("Reader cannot change a comic's genres", Boolean(readerGenres), readerGenres?.message);

    const { error: adminGenres } = await admin.client.rpc("set_comic_genres", { p_comic_id: pub, p_genre_ids: genreIds });
    const { data: links } = await service.from("comic_genres").select("genre_id").eq("comic_id", pub);
    check("Admin can set a comic's genres", !adminGenres && links?.length === genreIds.length, adminGenres?.message ?? JSON.stringify(links));

    const { data: delLive } = await owner.client.from("comics").delete().eq("id", hidden).select("id");
    check("Owner cannot permanently delete a comic that isn't in the trash", (delLive ?? []).length === 0, JSON.stringify(delLive));

    must("trash", await admin.client.from("comics").update({ deleted_at: new Date().toISOString() }).eq("id", hidden));
    const { data: delByAdmin } = await admin.client.from("comics").delete().eq("id", hidden).select("id");
    check("Admin (not owner) cannot permanently delete, even from the trash", (delByAdmin ?? []).length === 0, JSON.stringify(delByAdmin));

    const { data: delByOwner } = await owner.client.from("comics").delete().eq("id", hidden).select("id");
    check("Owner can permanently delete a comic from the trash", delByOwner?.length === 1, JSON.stringify(delByOwner));
  }

  // ---- Phase 7: chapter page functions, permanent chapter deletion -----------
  {
    const fakePage = [{ storage_key: `chapters/${released}/x.webp`, width: 10, height: 10, bytes: 10 }];
    const { error: readerAppend } = await a.client.rpc("append_chapter_images", { p_chapter_id: released, p_pages: fakePage });
    check("Reader cannot add chapter pages", Boolean(readerAppend), readerAppend?.message);

    const { data: imgs } = await service.from("chapter_images").select("id").eq("chapter_id", released);
    const ids = (imgs ?? []).map((i) => i.id);
    const { error: readerReorder } = await a.client.rpc("reorder_chapter_images", { p_chapter_id: released, p_image_ids: ids });
    check("Reader cannot reorder chapter pages", Boolean(readerReorder), readerReorder?.message);

    const { error: adminReorder } = await admin.client.rpc("reorder_chapter_images", { p_chapter_id: released, p_image_ids: ids });
    check("Admin can reorder chapter pages", !adminReorder, adminReorder?.message);

    must("remove chapter", await admin.client.from("chapters").update({ deleted_at: new Date().toISOString() }).eq("id", draft));
    const { data: adminDel } = await admin.client.from("chapters").delete().eq("id", draft).select("id");
    check("Admin (not owner) cannot permanently delete a removed chapter", (adminDel ?? []).length === 0, JSON.stringify(adminDel));
    const { data: liveDel } = await admin.client.from("chapters").delete().eq("id", released).select("id");
    check("Nobody deletes a chapter that wasn't removed first", (liveDel ?? []).length === 0, JSON.stringify(liveDel));
  }

  // ---- Phase 8: view counting can only go through the website's server ------
  {
    const { error: anonView } = await anon.rpc("record_chapter_view", { p_chapter_id: released, p_visitor_hash: "x".repeat(32) });
    check("Visitor cannot call the view counter directly", Boolean(anonView), anonView?.message);
    const { error: readerView } = await a.client.rpc("record_chapter_view", { p_chapter_id: released, p_visitor_hash: "y".repeat(32) });
    check("Reader cannot call the view counter directly", Boolean(readerView), readerView?.message);
    const { data: dedupe } = await anon.from("chapter_view_dedupe").select("visitor_hash").limit(1);
    check("Nobody can read the visitor codes", (dedupe ?? []).length === 0, JSON.stringify(dedupe));
    const { error: forgeViews } = await a.client.from("comic_views_daily").insert({ comic_id: pub, views: 9999 });
    check("Nobody can write view counts directly", Boolean(forgeViews), forgeViews?.message);
  }

  // ---- Phase 6b: image storage (bucket "images") ------------------------------
  {
    // A 1x1 WebP image.
    const webp = Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64");
    const path = `rls-test/${run}/pixel.webp`;
    const opts = { contentType: "image/webp", upsert: false };

    const { error: readerUp } = await a.client.storage.from("images").upload(`rls-test/${run}/reader.webp`, webp, opts);
    check("Reader cannot upload images", Boolean(readerUp), readerUp?.message);

    const { error: anonUp } = await anon.storage.from("images").upload(`rls-test/${run}/anon.webp`, webp, opts);
    check("Visitor cannot upload images", Boolean(anonUp), anonUp?.message);

    const { error: adminUp } = await admin.client.storage.from("images").upload(path, webp, opts);
    check("Admin can upload a WebP image", !adminUp, adminUp?.message);

    const { error: pngUp } = await admin.client.storage
      .from("images")
      .upload(`rls-test/${run}/x.png`, Buffer.from("not really a png"), { contentType: "image/png" });
    check("The bucket refuses non-WebP files, even from an admin", Boolean(pngUp), pngUp?.message);

    const publicUrl = `${url}/storage/v1/object/public/images/${path}`;
    const res = await fetch(publicUrl);
    check("Anyone can view a stored image by its address", res.ok && res.headers.get("content-type")?.includes("image/webp"), `${res.status}`);

    const { data: readerDel } = await a.client.storage.from("images").remove([path]);
    const still = await fetch(publicUrl, { cache: "no-store" });
    check("Reader cannot delete images", (readerDel ?? []).length === 0 && still.ok, `${JSON.stringify(readerDel)} ${still.status}`);

    const { error: adminDel } = await admin.client.storage.from("images").remove([path]);
    check("Admin can delete images", !adminDel, adminDel?.message);
    await service.storage.from("images").remove([path]);
  }
}

async function cleanup() {
  if (created.comics.length) await service.from("comics").delete().in("id", created.comics);
  if (created.genres.length) await service.from("genres").delete().in("id", created.genres);
  for (const id of created.users) await service.auth.admin.deleteUser(id);
}

let crashed = null;
try {
  await main();
} catch (err) {
  crashed = err;
} finally {
  await cleanup().catch((err) => console.error(`Cleanup problem: ${err.message}`));
}

for (const r of results) {
  console.log(`${r.passed ? "PASS" : "FAIL"}  ${r.name}${r.passed ? "" : `\n      got: ${r.detail}`}`);
}
if (crashed) console.error(`\nStopped early: ${crashed.message}`);
const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed}/${results.length} checks passed${crashed ? " (incomplete run)" : ""}.`);
process.exit(failed || crashed ? 1 : 0);
