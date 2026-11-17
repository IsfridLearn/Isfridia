// End-to-end check of the admin comic and genre tools against a RUNNING site.
// Run the site first (npm run build && npm run start), then: npm run test:comics
// Optional: BASE_URL (default http://localhost:3000).
//
// It submits the real admin forms the way a browser does (the forms work
// without JavaScript, so their hidden fields are enough), as a temporary admin
// and a temporary reader, and checks the database and public pages after each
// step. Everything it creates is deleted at the end.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secretKey) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.");
  process.exit(1);
}

const service = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const run = Date.now().toString(36);
const created = { users: [], comics: [], genres: [] };
const results = [];
const check = (name, passed, detail = "") => results.push({ name, passed: Boolean(passed), detail });

// ---- helpers ------------------------------------------------------------------

async function session(tag, role) {
  const email = `cms-${tag}-${run}@example.com`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: `${randomUUID()}Aa1!`,
    email_confirm: true,
    user_metadata: { username: `t_${tag}_${run}` },
  });
  if (error) throw new Error(`create ${tag}: ${error.message}`);
  created.users.push(data.user.id);
  if (role) await service.from("admin_permissions").insert({ user_id: data.user.id, role });
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email });
  const res = await fetch(`${base}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/account`, {
    redirect: "manual",
  });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => !c.endsWith("="))
    .join("; ");
  return { id: data.user.id, cookie };
}

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? decode(m[1]) : null;
};

async function getPage(path, cookie) {
  const res = await fetch(`${base}${path}`, { headers: cookie ? { cookie } : {} });
  return { status: res.status, html: await res.text() };
}

// Finds the first <form> whose HTML contains `marker`, fills it like a browser
// (hidden fields + the form's current values + overrides) and submits it.
async function submitForm(path, cookie, marker, overrides = {}, html) {
  const page = html ?? (await getPage(path, cookie)).html;
  const form = [...page.matchAll(/<form[^>]*>[\s\S]*?<\/form>/g)].map((m) => m[0]).find((f) => f.includes(marker));
  if (!form) throw new Error(`No form containing ${marker} on ${path}`);

  const body = new FormData();
  for (const [tag] of form.matchAll(/<input\b[^>]*>/g)) {
    const name = attr(tag, "name");
    if (!name || name in overrides) continue;
    const type = attr(tag, "type") ?? "text";
    if (type === "checkbox" && !/\schecked=""/.test(tag)) continue;
    body.append(name, attr(tag, "value") ?? (type === "checkbox" ? "on" : ""));
  }
  for (const m of form.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) {
    const name = attr(m[1], "name");
    if (name && !(name in overrides)) body.append(name, decode(m[2]));
  }
  for (const m of form.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
    const name = attr(m[1], "name");
    if (!name || name in overrides) continue;
    const selected = m[2].match(/<option[^>]*selected=""[^>]*value="([^"]*)"|<option[^>]*value="([^"]*)"[^>]*selected=""/);
    const first = m[2].match(/<option[^>]*value="([^"]*)"/);
    body.append(name, decode(selected?.[1] ?? selected?.[2] ?? first?.[1] ?? ""));
  }
  for (const [name, value] of Object.entries(overrides)) {
    for (const v of Array.isArray(value) ? value : [value]) {
      if (v instanceof Blob) body.append(name, v, "upload.bin");
      else if (v !== null) body.append(name, v);
    }
  }

  // Browsers always send Origin with a form post; Next.js uses it to block
  // cross-site action requests.
  const res = await fetch(`${base}${path}`, { method: "POST", body, headers: { cookie, origin: base }, redirect: "manual" });
  return { status: res.status, location: res.headers.get("location"), html: await res.text() };
}

// A real comic page has a "Chapters" section; the 404 page doesn't. (Don't test
// for the text "Page not found": Next.js embeds the 404 template in every page.)
const showsComic = (html) => html.includes('id="chapters-heading"');

const comicRow = async (id) =>
  (await service.from("comics").select("title, slug, is_published, deleted_at").eq("id", id).maybeSingle()).data;

// ---- the test -------------------------------------------------------------------

try {
  const admin = await session("adm", "admin");
  const reader = await session("rdr", null);
  const { data: genres } = await service.from("genres").select("id").order("name").limit(2);
  const genreIds = genres.map((g) => String(g.id));
  const title = `E2E Comic ${run}`;
  const slug = `e2e-comic-${run}`;

  // Create
  const createRes = await submitForm("/admin/comics/new", admin.cookie, 'name="title"', {
    title,
    slug: "",
    synopsis: "Made by the end-to-end test.",
    genreIds,
    isPublished: "on",
  });
  const comicId = createRes.location?.match(/\/admin\/comics\/([0-9a-f-]{36})\?saved=1/)?.[1];
  check("Create comic redirects to its edit page with 'saved'", comicId, `${createRes.status} ${createRes.location}`);
  if (!comicId) throw new Error("create failed; stopping");
  created.comics.push(comicId);

  const row = await comicRow(comicId);
  const { data: links } = await service.from("comic_genres").select("genre_id").eq("comic_id", comicId);
  check("Comic saved with an auto URL name, published, and 2 genres", row?.slug === slug && row?.is_published && links?.length === 2, JSON.stringify({ row, links }));

  const { data: audit } = await service.from("audit_log").select("actor_id").eq("table_name", "comics").eq("row_id", comicId).eq("action", "insert");
  check("The creation is in the audit log under the admin", audit?.[0]?.actor_id === admin.id, JSON.stringify(audit));

  const publicPage = await getPage(`/comics/${slug}`);
  check("The new comic is on the public site straight away", publicPage.html.includes(title) && showsComic(publicPage.html));

  // Cover upload: a real JPEG is converted to two WebP files and shown publicly
  const sharp = (await import("sharp")).default;
  const photo = (colour) =>
    sharp({ create: { width: 1200, height: 1600, channels: 3, background: colour } }).jpeg().toBuffer();
  const imageBase = `${url}/storage/v1/object/public/images`;
  const coverKeyOf = async () => (await service.from("comics").select("cover_key").eq("id", comicId).single()).data?.cover_key;

  await submitForm(`/admin/comics/${comicId}`, admin.cookie, 'name="cover"', {
    cover: new Blob([await photo("#884422")], { type: "image/jpeg" }),
  });
  const firstKey = await coverKeyOf();
  check("Uploading a cover stores it under covers/<comic id>/", firstKey?.startsWith(`covers/${comicId}/`), String(firstKey));
  const large = firstKey ? await fetch(`${imageBase}/${firstKey}-600.webp`) : null;
  const small = firstKey ? await fetch(`${imageBase}/${firstKey}-300.webp`) : null;
  check(
    "…as two WebP files, publicly viewable",
    large?.ok && small?.ok && large.headers.get("content-type")?.includes("webp"),
    `${large?.status} ${small?.status}`,
  );
  check(
    "…and the public comic page shows it",
    (await getPage(`/comics/${slug}`)).html.includes(`${firstKey}-600.webp`),
  );

  const notImage = await submitForm(`/admin/comics/${comicId}`, admin.cookie, 'name="cover"', {
    cover: new Blob(["<html>definitely not an image</html>"], { type: "image/png" }),
  });
  check(
    "A fake image is refused with a clear message, cover unchanged",
    /isn(&#x27;|')t an image we can read/.test(notImage.html) && (await coverKeyOf()) === firstKey,
    `${notImage.status}`,
  );

  await submitForm(`/admin/comics/${comicId}`, admin.cookie, 'name="cover"', {
    cover: new Blob([await photo("#224488")], { type: "image/jpeg" }),
  });
  const secondKey = await coverKeyOf();
  const oldGone = await fetch(`${imageBase}/${firstKey}-600.webp?check=${Date.now()}`, { cache: "no-store" });
  check("Replacing the cover swaps it and deletes the old files", secondKey && secondKey !== firstKey && !oldGone.ok, `${secondKey} old:${oldGone.status}`);

  await submitForm(`/admin/comics/${comicId}`, admin.cookie, "Remove cover</button>");
  const removedGone = await fetch(`${imageBase}/${secondKey}-600.webp?check=${Date.now()}`, { cache: "no-store" });
  check("Remove cover clears it and deletes its files", (await coverKeyOf()) === null && !removedGone.ok, `old:${removedGone.status}`);

  // Validation keeps what was typed
  const invalid = await submitForm("/admin/comics/new", admin.cookie, 'name="title"', {
    title: "",
    releaseYear: "abc",
    synopsis: "Typed text that must survive",
  });
  check(
    "Invalid form shows field errors and keeps the typed text",
    invalid.html.includes("Enter a title.") && invalid.html.includes("4-digit year") && invalid.html.includes("Typed text that must survive"),
    `${invalid.status}`,
  );

  const duplicate = await submitForm("/admin/comics/new", admin.cookie, 'name="title"', { title: "Another", slug });
  check("A second comic can't take the same URL name", duplicate.html.includes("Another comic already uses this URL name"), `${duplicate.status}`);

  // Unpublish from the list
  await submitForm("/admin/comics", admin.cookie, `aria-label="Published: ${title}"`);
  check("Unpublish switch hides the comic", (await comicRow(comicId))?.is_published === false);
  check("…and the public page is gone", !showsComic((await getPage(`/comics/${slug}`)).html));

  // A reader replaying the admin's "publish" form must change nothing
  const adminListHtml = (await getPage("/admin/comics", admin.cookie)).html;
  await submitForm("/admin/comics", reader.cookie, `aria-label="Published: ${title}"`, {}, adminListHtml);
  check("A reader replaying an admin button changes nothing", (await comicRow(comicId))?.is_published === false);

  // Edit
  const edited = await submitForm(`/admin/comics/${comicId}`, admin.cookie, 'name="title"', { title: `${title} (edited)` });
  check("Edit saves and redirects", edited.location?.includes(`/admin/comics/${comicId}?saved=1`), `${edited.status} ${edited.location}`);
  check("…with the new title in the database", (await comicRow(comicId))?.title === `${title} (edited)`);

  // Trash and restore
  await submitForm(`/admin/comics/${comicId}`, admin.cookie, "Move to trash</button>");
  check("Move to trash sets the comic aside", Boolean((await comicRow(comicId))?.deleted_at));
  const trashHtml = (await getPage("/admin/trash", admin.cookie)).html;
  check("It is listed in the Trash", trashHtml.includes(`${title} (edited)`));
  await submitForm("/admin/trash", admin.cookie, "Restore</button>", {}, trashHtml);
  check("Restore brings it back", (await comicRow(comicId))?.deleted_at === null);

  // Genres
  const genreName = `E2E Genre ${run}`;
  await submitForm("/admin/genres", admin.cookie, 'placeholder="New genre', { name: genreName });
  const { data: g } = await service.from("genres").select("id, slug").eq("name", genreName).maybeSingle();
  if (g) created.genres.push(g.id);
  check("Add genre creates it with a URL name", g?.slug === `e2e-genre-${run}`, JSON.stringify(g));
  if (g) {
    await submitForm("/admin/genres", admin.cookie, `Remove <span class="font-semibold">${genreName}</span>`);
    const { data: gone } = await service.from("genres").select("id").eq("id", g.id);
    check("Delete genre removes it", (gone ?? []).length === 0, JSON.stringify(gone));
  }

  // Reader can't even see the dashboard
  const readerDash = await getPage("/admin", reader.cookie);
  check(
    "A reader gets 'not found' for the dashboard",
    readerDash.html.includes('<meta name="robots" content="noindex"/>') && !readerDash.html.includes("Recently added comics"),
  );
} catch (err) {
  check("Test ran to completion", false, err.message);
} finally {
  for (const comicId of created.comics) {
    const { data: files } = await service.storage.from("images").list(`covers/${comicId}`);
    if (files?.length) await service.storage.from("images").remove(files.map((f) => `covers/${comicId}/${f.name}`));
  }
  if (created.comics.length) await service.from("comics").delete().in("id", created.comics);
  if (created.genres.length) await service.from("genres").delete().in("id", created.genres);
  for (const id of created.users) await service.auth.admin.deleteUser(id);
}

for (const r of results) console.log(`${r.passed ? "PASS" : "FAIL"}  ${r.name}${r.passed || !r.detail ? "" : `\n      got: ${r.detail}`}`);
const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
