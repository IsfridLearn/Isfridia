// End-to-end check of the reader, view counting and saved progress against a
// RUNNING site. Run: npm run build && npm run start, then: npm run test:reader
// Optional: BASE_URL (default http://localhost:3000).
// Uses a temporary comic with real page images and a temporary reader account;
// everything is deleted at the end.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !publishableKey || !secretKey) {
  console.error("Needs the Supabase settings in .env.local.");
  process.exit(1);
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, secretKey, noSession);
const run = Date.now().toString(36);
const slug = `e2e-reader-${run}`;
const created = { users: [], comicId: null, files: [] };
const results = [];
const check = (name, passed, detail = "") => results.push({ name, passed: Boolean(passed), detail });

const html = async (path, cookie) => (await fetch(`${base}${path}`, { headers: cookie ? { cookie } : {} })).text();
const isNotFound = (page) => page.includes('<meta name="robots" content="noindex"/>') && !page.includes('id="end-heading"');
const viewsToday = async () =>
  (await service.from("comic_views_daily").select("views").eq("comic_id", created.comicId).eq("day", new Date().toISOString().slice(0, 10)).maybeSingle()).data?.views ?? 0;
const postView = (chapterId, ip, origin = base) =>
  fetch(`${base}/api/views`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip, origin },
    body: JSON.stringify({ chapterId }),
  });

try {
  // ---- Setup: a comic with chapters 1, 1.5, 2 (released), 3 (scheduled), 4 (draft)
  const { data: comic } = await service.from("comics").insert({ slug, title: `E2E Reader ${run}`, is_published: true }).select("id").single();
  created.comicId = comic.id;
  const hour = 3600 * 1000;
  const past = (h) => new Date(Date.now() - h * hour).toISOString();
  const { data: chapters } = await service
    .from("chapters")
    .insert([
      { comic_id: comic.id, number: 1, title: "Opening", status: "published", published_at: past(30) },
      { comic_id: comic.id, number: 1.5, status: "published", published_at: past(20) },
      { comic_id: comic.id, number: 2, title: "Second", status: "published", published_at: past(10) },
      { comic_id: comic.id, number: 3, status: "published", published_at: new Date(Date.now() + 24 * hour).toISOString() },
      { comic_id: comic.id, number: 4, status: "draft" },
    ])
    .select("id, number");
  const idOf = Object.fromEntries(chapters.map((c) => [Number(c.number), c.id]));

  // Two real pages for chapter 1, one for each other chapter.
  const pageSizes = { 1: [[800, 1200], [800, 900]], 1.5: [[800, 1000]], 2: [[800, 1000]], 3: [[800, 1000]] };
  for (const [num, sizes] of Object.entries(pageSizes)) {
    const rows = [];
    for (const [i, [w, h]] of sizes.entries()) {
      const key = `chapters/${idOf[num]}/${randomUUID()}.webp`;
      const bytes = await sharp({ create: { width: w, height: h, channels: 3, background: "#446688" } }).webp().toBuffer();
      await service.storage.from("images").upload(key, bytes, { contentType: "image/webp" });
      created.files.push(key);
      rows.push({ chapter_id: idOf[num], position: i, storage_key: key, width: w, height: h, bytes: bytes.length });
    }
    await service.from("chapter_images").insert(rows);
  }

  // ---- Reader pages
  const ch1 = await html(`/comics/${slug}/chapter-1`);
  const imgs = [...ch1.matchAll(/<img [^>]*alt="Page (\d) of 2"[^>]*>/g)].map((m) => m[0]);
  check("Chapter 1 shows its 2 pages, in order", imgs.length === 2 && ch1.indexOf("Page 1 of 2") < ch1.indexOf("Page 2 of 2"), `${imgs.length} images`);
  check("Each page reserves its space (width and height set)", imgs.every((t) => /width="800"/.test(t) && /height="(1200|900)"/.test(t)));
  check("The first page is fetched with high priority", /fetchPriority="high"/.test(imgs[0] ?? ""), imgs[0]);
  check("Chapter page title names the chapter and comic", ch1.includes(`<title>Chapter 1: Opening · E2E Reader ${run} · IsfridVerse</title>`));
  check("Chapter 1: Next goes to 1.5, and there is no Previous link", ch1.includes(`href="/comics/${slug}/chapter-1-5"`) && !ch1.includes(`href="/comics/${slug}/chapter-0"`));

  const ch15 = await html(`/comics/${slug}/chapter-1-5`);
  check("Chapter 1.5 links back to 1 and on to 2", ch15.includes(`href="/comics/${slug}/chapter-1"`) && ch15.includes(`href="/comics/${slug}/chapter-2"`));

  const ch2 = await html(`/comics/${slug}/chapter-2`);
  check(
    "Latest released chapter says you're caught up, and never links to hidden chapters",
    /all caught up/.test(ch2) && !ch2.includes("chapter-3") && !ch2.includes("chapter-4") && !/value="3"/.test(ch2),
  );

  check("A scheduled chapter is not readable yet", isNotFound(await html(`/comics/${slug}/chapter-3`)));
  check("A draft chapter is not readable", isNotFound(await html(`/comics/${slug}/chapter-4`)));
  check("Malformed chapter addresses are not found", isNotFound(await html(`/comics/${slug}/chapter-01`)) && isNotFound(await html(`/comics/${slug}/chapter-abc`)));
  check("A chapter of a missing comic is not found", isNotFound(await html(`/comics/no-such-comic-${run}/chapter-1`)));

  // ---- Comic page entry points
  const comicPage = await html(`/comics/${slug}`);
  check(
    "Comic page: Start reading opens chapter 1, Latest opens chapter 2",
    /href="\/comics\/[^"]+\/chapter-1"[^>]*>Start reading/.test(comicPage) && /href="\/comics\/[^"]+\/chapter-2"[^>]*>Latest/.test(comicPage),
  );
  check("Comic page: chapter rows open the reader", comicPage.includes(`href="/comics/${slug}/chapter-1-5"`));

  // ---- View counting
  const before = await viewsToday();
  const v1 = await postView(idOf[1], "203.0.113.10");
  const afterFirst = await viewsToday();
  await postView(idOf[1], "203.0.113.10");
  await postView(idOf[1], "203.0.113.10");
  const afterRepeat = await viewsToday();
  await postView(idOf[1], "203.0.113.11");
  const afterOther = await viewsToday();
  check("A view is counted (204)", v1.status === 204 && afterFirst === before + 1, `${v1.status} ${before}->${afterFirst}`);
  check("The same visitor re-opening the chapter today isn't counted again", afterRepeat === afterFirst, `${afterFirst}->${afterRepeat}`);
  check("A different visitor is counted", afterOther === afterRepeat + 1, `${afterRepeat}->${afterOther}`);
  await postView(idOf[3], "203.0.113.12");
  await postView(idOf[4], "203.0.113.12");
  check("Scheduled and draft chapters don't collect views", (await viewsToday()) === afterOther);
  const foreign = await postView(idOf[1], "203.0.113.13", "https://evil.example");
  check("Requests from another website are refused", foreign.status === 403 && (await viewsToday()) === afterOther, `${foreign.status}`);
  const bad = await fetch(`${base}/api/views`, { method: "POST", headers: { origin: base }, body: "{not json" });
  check("A malformed request is rejected", bad.status === 400, `${bad.status}`);

  // ---- Saved progress for a logged-in reader (done the way the reader page does it)
  const email = `rdr-${run}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  const { data: u } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  created.users.push(u.user.id);
  const readerClient = createClient(url, publishableKey, noSession);
  await readerClient.auth.signInWithPassword({ email, password });
  const { error: saveErr } = await readerClient
    .from("reading_history")
    .upsert({ user_id: u.user.id, chapter_id: idOf[1], comic_id: comic.id, progress: 0.4, last_image_index: 1 }, { onConflict: "user_id,chapter_id" });
  check("A logged-in reader's progress saves", !saveErr, saveErr?.message);
  const { error: schedErr } = await readerClient
    .from("reading_history")
    .upsert({ user_id: u.user.id, chapter_id: idOf[3], comic_id: comic.id, progress: 0.1, last_image_index: 0 }, { onConflict: "user_id,chapter_id" });
  check("Progress can't be saved for a scheduled chapter", Boolean(schedErr), schedErr?.message);

  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email });
  const login = await fetch(`${base}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/account`, { redirect: "manual" });
  const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).filter((c) => !c.endsWith("=")).join("; ");
  const personal = await html(`/comics/${slug}`, cookie);
  check("Comic page shows that reader 'Continue Chapter 1 · 40%'", /Continue Chapter (<!-- -->)?1/.test(personal) && /40(<!-- -->)?%/.test(personal));
  check("…and a logged-out visitor doesn't see it", !/Continue Chapter/.test(comicPage));

  // ---- Elsewhere on the site, chapters open the reader
  const latest = await html("/latest");
  check("The Latest feed links straight to chapters", /href="\/comics\/[^"]+\/chapter-\d+(-\d+)?"/.test(latest));
} catch (err) {
  check("Test ran to completion", false, err.message);
} finally {
  if (created.files.length) await service.storage.from("images").remove(created.files);
  if (created.comicId) await service.from("comics").delete().eq("id", created.comicId);
  for (const id of created.users) await service.auth.admin.deleteUser(id);
}

for (const r of results) console.log(`${r.passed ? "PASS" : "FAIL"}  ${r.name}${r.passed || !r.detail ? "" : `\n      got: ${r.detail}`}`);
const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
