// End-to-end check of chapter management against a RUNNING site built with
// `npm run build` (it reads the server-action ids from .next).
// Run: npm run build && npm run start, then: npm run test:chapters
// Optional: BASE_URL (default http://localhost:3000).
//
// It does what the admin's browser does: uploads WebP files straight to
// storage with the admin's login, calls the same server actions the uploader
// calls, and submits the chapter forms. Uses a temporary comic and temporary
// users; everything is deleted at the end.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
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
const anon = createClient(url, publishableKey, noSession);
const run = Date.now().toString(36);
const created = { users: [], comics: [] };
const results = [];
const check = (name, passed, detail = "") => results.push({ name, passed: Boolean(passed), detail });

// ---- helpers ------------------------------------------------------------------

const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const actionId = (name) => {
  const id = Object.keys(manifest).find((k) => manifest[k].exportedName === name && manifest[k].filename.includes("chapters/actions"));
  if (!id) throw new Error(`No server action named ${name} in the build. Run npm run build first.`);
  return id;
};

async function user(tag, role) {
  const email = `chp-${tag}-${run}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`create ${tag}: ${error.message}`);
  created.users.push(data.user.id);
  if (role) await service.from("admin_permissions").insert({ user_id: data.user.id, role });
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email });
  const res = await fetch(`${base}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/account`, { redirect: "manual" });
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).filter((c) => !c.endsWith("=")).join("; ");
  const client = createClient(url, publishableKey, noSession);
  const { data: signIn } = await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, cookie, token: signIn.session.access_token };
}

// Calls a server action the way the browser does (Next-Action header + JSON args).
async function callAction(path, name, args, cookie) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", origin: base, cookie },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  for (const line of text.split("\n")) {
    const m = line.match(/^[0-9a-f]+:(\{.*\})$/);
    if (!m) continue;
    try {
      const value = JSON.parse(m[1]);
      if ("added" in value || "error" in value || Object.keys(value).length === 0) return value;
    } catch {}
  }
  return { raw: text.slice(0, 200), status: res.status };
}

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&");
async function submitForm(path, cookie, marker, overrides = {}) {
  const html = await (await fetch(`${base}${path}`, { headers: { cookie } })).text();
  const form = [...html.matchAll(/<form[^>]*>[\s\S]*?<\/form>/g)].map((m) => m[0]).find((f) => f.includes(marker));
  if (!form) throw new Error(`No form containing ${marker} on ${path}`);
  const body = new FormData();
  for (const [tag] of form.matchAll(/<input\b[^>]*>/g)) {
    const name = tag.match(/\sname="([^"]*)"/)?.[1];
    if (!name || name in overrides) continue;
    const type = tag.match(/\stype="([^"]*)"/)?.[1] ?? "text";
    if ((type === "radio" || type === "checkbox") && !/\schecked=""/.test(tag)) continue;
    body.append(name, decode(tag.match(/\svalue="([^"]*)"/)?.[1] ?? ""));
  }
  for (const [k, v] of Object.entries(overrides)) body.append(k, v);
  const res = await fetch(`${base}${path}`, { method: "POST", body, headers: { cookie, origin: base }, redirect: "manual" });
  return { status: res.status, location: res.headers.get("location"), html: await res.text() };
}

async function uploadToStorage(token, path, bytes) {
  const res = await fetch(`${url}/storage/v1/object/images/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: publishableKey, "Content-Type": "image/webp", "x-upsert": "false" },
    body: bytes,
  });
  return res.ok;
}

const webp = (w, h, colour) => sharp({ create: { width: w, height: h, channels: 3, background: colour } }).webp({ quality: 80 }).toBuffer();
const pagesOf = async (chapterId) =>
  (await service.from("chapter_images").select("id, position, storage_key, width, height").eq("chapter_id", chapterId).order("position")).data ?? [];
const fileExists = async (path) => (await fetch(`${url}/storage/v1/object/public/images/${path}?v=${Date.now()}`, { cache: "no-store" })).ok;
const chapterRow = async (id) => (await service.from("chapters").select("status, published_at, deleted_at, title").eq("id", id).maybeSingle()).data;

// ---- the test -------------------------------------------------------------------

try {
  const admin = await user("adm", "admin");
  const owner = await user("own", "owner");
  const reader = await user("rdr", null);

  const slug = `e2e-chapters-${run}`;
  const { data: comic } = await service.from("comics").insert({ slug, title: `E2E Chapters ${run}`, is_published: true }).select("id").single();
  created.comics.push(comic.id);
  const listPath = `/admin/comics/${comic.id}/chapters`;

  // Create chapter 1
  const made = await submitForm(listPath, admin.cookie, 'name="number"', { number: "1", title: "The Beginning" });
  const chapterId = made.location?.match(/chapters\/([0-9a-f-]{36})\?created=1/)?.[1];
  check("New chapter is created as a draft and opens its editor", chapterId && (await chapterRow(chapterId))?.status === "draft", `${made.status} ${made.location}`);
  if (!chapterId) throw new Error("create failed; stopping");
  const editorPath = `${listPath}/${chapterId}`;

  const dup = await submitForm(listPath, admin.cookie, 'name="number"', { number: "1" });
  check("A second chapter 1 is refused", dup.html.includes("Chapter 1 already exists"));

  const noPages = await submitForm(editorPath, admin.cookie, 'name="visibility"', { visibility: "now" });
  check("Publishing without pages is refused", noPages.html.includes("Upload at least one page before publishing") && (await chapterRow(chapterId))?.status === "draft");

  // Upload like the browser: 3 real pages, 1 fake WebP, 1 in the wrong folder
  const good = [
    { path: `chapters/${chapterId}/${randomUUID()}.webp`, bytes: await webp(800, 1200, "#aa3333") },
    { path: `chapters/${chapterId}/${randomUUID()}.webp`, bytes: await webp(800, 900, "#33aa33") },
    { path: `chapters/${chapterId}/${randomUUID()}.webp`, bytes: await webp(800, 1500, "#3333aa") },
  ];
  const fakePath = `chapters/${chapterId}/${randomUUID()}.webp`;
  const fakeBytes = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#fff" } }).png().toBuffer();
  const wrongPath = `chapters/${randomUUID()}/${randomUUID()}.webp`;
  const uploads = await Promise.all([
    ...good.map((g) => uploadToStorage(admin.token, g.path, g.bytes)),
    uploadToStorage(admin.token, fakePath, fakeBytes),
    uploadToStorage(admin.token, wrongPath, good[0].bytes),
  ]);
  check("Admin's browser-style uploads to storage succeed", uploads.every(Boolean), JSON.stringify(uploads));

  const readerAttempt = await callAction(editorPath, "addChapterPages", [chapterId, good.map(({ path }) => ({ path }))], reader.cookie);
  check("A reader calling the add-pages action is refused", readerAttempt.error?.includes("permission") && (await pagesOf(chapterId)).length === 0, JSON.stringify(readerAttempt));

  const added = await callAction(editorPath, "addChapterPages", [chapterId, [...good, { path: fakePath }, { path: wrongPath }].map(({ path }) => ({ path }))], admin.cookie);
  let pages = await pagesOf(chapterId);
  check("Server adds the 3 real pages and rejects the 2 bad files", added.added === 3 && added.rejected?.length === 2, JSON.stringify(added));
  check(
    "Pages keep upload order, with sizes read from the files themselves",
    pages.map((p) => `${p.position}:${p.width}x${p.height}`).join(",") === "0:800x1200,1:800x900,2:800x1500",
    JSON.stringify(pages),
  );
  check("The fake WebP was deleted from storage", !(await fileExists(fakePath)));
  await service.storage.from("images").remove([wrongPath]);

  // Reorder
  const reversed = [...pages].reverse().map((p) => p.id);
  const reorder = await callAction(editorPath, "reorderPages", [chapterId, reversed], admin.cookie);
  pages = await pagesOf(chapterId);
  check("Reorder saves the new order", !reorder.error && pages.map((p) => p.id).join() === reversed.join(), JSON.stringify(reorder));
  const stale = await callAction(editorPath, "reorderPages", [chapterId, reversed.slice(1)], admin.cookie);
  check("An out-of-date page list is refused", stale.error?.includes("out of date"), JSON.stringify(stale));

  // Delete a page
  const victim = pages[1];
  const del = await callAction(editorPath, "deletePage", [chapterId, victim.id], admin.cookie);
  pages = await pagesOf(chapterId);
  check(
    "Deleting a page removes it and its file, positions close the gap",
    !del.error && pages.length === 2 && pages.map((p) => p.position).join() === "0,1" && !(await fileExists(victim.storage_key)),
    JSON.stringify({ del, pages }),
  );

  // Publish now
  await submitForm(editorPath, admin.cookie, 'name="visibility"', { visibility: "now" });
  const published = await chapterRow(chapterId);
  check("Publish now releases the chapter", published?.status === "published" && new Date(published.published_at) <= new Date(), JSON.stringify(published));
  const publicHtml = await (await fetch(`${base}/comics/${slug}`)).text();
  check("It appears on the public comic page", /Chapter (<!-- -->)?1/.test(publicHtml) && publicHtml.includes("The Beginning"));
  const { data: publicPages } = await anon.from("chapter_images").select("id").eq("chapter_id", chapterId);
  check("Visitors can now load its pages", publicPages?.length === 2, JSON.stringify(publicPages));

  await new Promise((r) => setTimeout(r, 1100));
  await submitForm(editorPath, admin.cookie, 'name="visibility"', { visibility: "now", title: "The Beginning (fixed typo)" });
  const edited = await chapterRow(chapterId);
  check("Editing a released chapter keeps its original release date", edited?.title === "The Beginning (fixed typo)" && edited?.published_at === published?.published_at, JSON.stringify(edited));

  // Schedule chapter 2 for an hour from now
  const made2 = await submitForm(listPath, admin.cookie, 'name="number"', { number: "2" });
  const chapter2 = made2.location?.match(/chapters\/([0-9a-f-]{36})\?created=1/)?.[1];
  const page2 = `chapters/${chapter2}/${randomUUID()}.webp`;
  await uploadToStorage(admin.token, page2, await webp(800, 1000, "#999900"));
  await callAction(`${listPath}/${chapter2}`, "addChapterPages", [chapter2, [{ path: page2 }]], admin.cookie);
  const inAnHour = new Date(Date.now() + 3600 * 1000).toISOString();
  const sched = await submitForm(`${listPath}/${chapter2}`, admin.cookie, 'name="visibility"', { visibility: "schedule", publishAt: inAnHour });
  const row2 = await chapterRow(chapter2);
  check("Scheduling sets a future release time", sched.html.includes("Scheduled.") && row2?.published_at && new Date(row2.published_at) > new Date(), JSON.stringify(row2));
  const { data: hiddenPages } = await anon.from("chapter_images").select("id").eq("chapter_id", chapter2);
  const publicHtml2 = await (await fetch(`${base}/comics/${slug}`)).text();
  check("A scheduled chapter and its pages stay hidden from visitors", (hiddenPages ?? []).length === 0 && !/Chapter (<!-- -->)?2</.test(publicHtml2), JSON.stringify(hiddenPages));

  // Remove, restore, delete forever
  await submitForm(editorPath, admin.cookie, "Remove chapter</button>");
  check("Remove hides the chapter", Boolean((await chapterRow(chapterId))?.deleted_at));
  await submitForm(listPath, admin.cookie, "Restore</button>");
  check("Restore brings it back", (await chapterRow(chapterId))?.deleted_at === null);

  await submitForm(editorPath, admin.cookie, "Remove chapter</button>");
  const byAdmin = await callAction(listPath, "deleteChapterForever", [chapterId], admin.cookie);
  check("An admin (not owner) can't delete a chapter permanently", byAdmin.error?.includes("owner") && (await chapterRow(chapterId)) !== null, JSON.stringify(byAdmin));
  const keys = (await pagesOf(chapterId)).map((p) => p.storage_key);
  const byOwner = await callAction(listPath, "deleteChapterForever", [chapterId], owner.cookie);
  const stillThere = await Promise.all(keys.map(fileExists));
  check("The owner can, and its page files are deleted too", !byOwner.error && (await chapterRow(chapterId)) === null && stillThere.every((x) => !x), JSON.stringify({ byOwner, stillThere }));

  const { data: log } = await service.from("audit_log").select("action").eq("table_name", "chapters").eq("row_id", chapterId);
  check("Chapter changes are in the audit log", (log ?? []).some((l) => l.action === "delete") && (log ?? []).some((l) => l.action === "insert"), JSON.stringify(log));
} catch (err) {
  check("Test ran to completion", false, err.message);
} finally {
  for (const comicId of created.comics) {
    const { data: chs } = await service.from("chapters").select("id").eq("comic_id", comicId);
    for (const ch of chs ?? []) {
      const { data: files } = await service.storage.from("images").list(`chapters/${ch.id}`);
      if (files?.length) await service.storage.from("images").remove(files.map((f) => `chapters/${ch.id}/${f.name}`));
    }
    await service.from("comics").delete().eq("id", comicId);
  }
  for (const id of created.users) await service.auth.admin.deleteUser(id);
}

for (const r of results) console.log(`${r.passed ? "PASS" : "FAIL"}  ${r.name}${r.passed || !r.detail ? "" : `\n      got: ${r.detail}`}`);
const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
