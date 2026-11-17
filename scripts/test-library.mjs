// End-to-end check of reader accounts (Phase 9) against a RUNNING site built
// with `npm run build`: bookmarks, favorites, history, profile, data export,
// and admin user roles. Run: npm run test:library  (BASE_URL optional)
// Uses temporary users and a temporary comic; everything is deleted at the end.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

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
const created = { users: [], comics: [] };
const results = [];
const check = (name, passed, detail = "") => results.push({ name, passed: Boolean(passed), detail });

// ---- helpers ------------------------------------------------------------------

const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const actionId = (name, file) => {
  const id = Object.keys(manifest).find((k) => manifest[k].exportedName === name && manifest[k].filename.includes(file));
  if (!id) throw new Error(`No server action ${name} in ${file}. Run npm run build first.`);
  return id;
};

async function user(tag, role) {
  const email = `lib-${tag}-${run}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  const username = `t_${tag}_${run}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username } });
  if (error) throw new Error(`create ${tag}: ${error.message}`);
  created.users.push(data.user.id);
  if (role) await service.from("admin_permissions").insert({ user_id: data.user.id, role });
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email });
  const res = await fetch(`${base}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/account`, { redirect: "manual" });
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).filter((c) => !c.endsWith("=")).join("; ");
  const client = createClient(url, publishableKey, noSession);
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, email, password, username, cookie, client };
}

const page = async (path, cookie) => {
  const res = await fetch(`${base}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  return { status: res.status, location: res.headers.get("location"), html: await res.text() };
};

async function callAction(path, name, file, args, cookie) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Next-Action": actionId(name, file), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", origin: base, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(args),
  });
  const objects = [];
  for (const line of (await res.text()).split("\n")) {
    const m = line.match(/^[0-9a-f]+:(\{.*\})$/);
    if (m) try { objects.push(JSON.parse(m[1])); } catch {}
  }
  return objects.find((o) => "bookmarked" in o || "favorite" in o || "error" in o) ?? objects.at(-1) ?? {};
}

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&");
async function submitForm(path, cookie, marker, overrides = {}, html) {
  const source = html ?? (await page(path, cookie)).html;
  const form = [...source.matchAll(/<form[^>]*>[\s\S]*?<\/form>/g)].map((m) => m[0]).find((f) => f.includes(marker));
  if (!form) throw new Error(`No form containing ${marker} on ${path}`);
  const body = new FormData();
  for (const [tag] of form.matchAll(/<input\b[^>]*>/g)) {
    const name = tag.match(/\sname="([^"]*)"/)?.[1];
    if (!name || name in overrides) continue;
    body.append(name, decode(tag.match(/\svalue="([^"]*)"/)?.[1] ?? ""));
  }
  for (const [k, v] of Object.entries(overrides)) body.append(k, v);
  const res = await fetch(`${base}${path}`, { method: "POST", body, headers: { cookie, origin: base }, redirect: "manual" });
  return { status: res.status, html: await res.text() };
}

const LIB = "library-actions";

// ---- the test -------------------------------------------------------------------

try {
  const a = await user("a", null);
  const b = await user("b", null);
  const owner = await user("own", "owner");
  const admin = await user("adm", "admin");

  const slug = `e2e-library-${run}`;
  const title = `E2E Library ${run}`;
  const { data: comic } = await service.from("comics").insert({ slug, title, is_published: true }).select("id").single();
  const { data: hidden } = await service.from("comics").insert({ slug: `${slug}-hidden`, title: `${title} hidden`, is_published: false }).select("id").single();
  created.comics.push(comic.id, hidden.id);
  const { data: chapter } = await service
    .from("chapters")
    .insert({ comic_id: comic.id, number: 1, status: "published", published_at: new Date(Date.now() - 3600_000).toISOString() })
    .select("id")
    .single();
  const comicPath = `/comics/${slug}`;

  // Logged out
  for (const path of ["/bookmarks", "/history", "/account"]) {
    const res = await page(path);
    check(`Logged-out visitors are sent to log in from ${path}`, res.html.includes(`/login?next=${encodeURIComponent(path)}`), `${res.status}`);
  }
  const anonComic = await page(comicPath);
  check("Comic page offers 'Log in to bookmark' to visitors", anonComic.html.includes("Log in to bookmark") && anonComic.html.includes(`next=${encodeURIComponent(comicPath)}`));
  const anonAction = await callAction(comicPath, "setBookmark", LIB, [comic.id, true]);
  check("Bookmarking while logged out does nothing", anonAction.error === "login", JSON.stringify(anonAction));

  // Bookmarks and favorites
  const bm = await callAction(comicPath, "setBookmark", LIB, [comic.id, true], a.cookie);
  const fav = await callAction(comicPath, "setFavorite", LIB, [comic.id, true], a.cookie);
  const { data: row } = await service.from("bookmarks").select("is_favorite").eq("user_id", a.id).eq("comic_id", comic.id).maybeSingle();
  check("A reader can bookmark and favorite a comic", bm.bookmarked && fav.favorite && row?.is_favorite === true, JSON.stringify({ bm, fav, row }));
  const aComic = await page(comicPath, a.cookie);
  check("The comic page shows both as on for that reader", (aComic.html.match(/aria-pressed="true"/g) ?? []).length >= 2);
  const hiddenBm = await callAction(comicPath, "setBookmark", LIB, [hidden.id, true], a.cookie);
  check("An unpublished comic can't be bookmarked", hiddenBm.error === "failed", JSON.stringify(hiddenBm));

  const aBookmarks = await page("/bookmarks", a.cookie);
  const aFavs = await page("/bookmarks?show=favorites", a.cookie);
  const bBookmarks = await page("/bookmarks", b.cookie);
  check("It's in their Bookmarks and Favorites", aBookmarks.html.includes(title) && aFavs.html.includes(title));
  check("Another reader's Bookmarks don't show it", !bBookmarks.html.includes(title) && bBookmarks.html.includes("No bookmarks yet"));

  await submitForm("/bookmarks", a.cookie, `aria-label="Remove ${title} from bookmarks"`, {}, aBookmarks.html);
  const { data: gone } = await service.from("bookmarks").select("comic_id").eq("user_id", a.id);
  check("Remove takes it out of their bookmarks", (gone ?? []).length === 0, JSON.stringify(gone));

  // History
  await a.client.from("reading_history").upsert(
    { user_id: a.id, chapter_id: chapter.id, comic_id: comic.id, progress: 0.4, last_image_index: 3 },
    { onConflict: "user_id,chapter_id" },
  );
  const aHistory = await page("/history", a.cookie);
  check("History lists the comic with chapter and progress", aHistory.html.includes(title) && /Chapter (<!-- -->)?1/.test(aHistory.html) && /40(<!-- -->)?%/.test(aHistory.html));
  check("…with a Continue link to the chapter", aHistory.html.includes(`href="/comics/${slug}/chapter-1"`));
  const home = await page("/", a.cookie);
  check("The homepage shows them a 'Continue reading' row", home.html.includes("Continue reading") && home.html.includes(title));
  const bHistory = await page("/history", b.cookie);
  check("Another reader's history doesn't show it", !bHistory.html.includes(title) && bHistory.html.includes("Nothing read yet"));
  await submitForm("/history", a.cookie, `aria-label="Remove ${title} from history"`, {}, aHistory.html);
  const { data: hist } = await service.from("reading_history").select("chapter_id").eq("user_id", a.id);
  check("Remove takes it out of their history", (hist ?? []).length === 0, JSON.stringify(hist));
  await a.client.from("reading_history").upsert({ user_id: a.id, chapter_id: chapter.id, comic_id: comic.id, progress: 0.7, last_image_index: 1 }, { onConflict: "user_id,chapter_id" });
  await callAction("/history", "clearHistory", LIB, [], a.cookie);
  const { data: cleared } = await service.from("reading_history").select("chapter_id").eq("user_id", a.id);
  check("Clear history empties it", (cleared ?? []).length === 0, JSON.stringify(cleared));

  // Profile
  const newName = `t_new_${run}`.slice(0, 24);
  await submitForm("/account", a.cookie, 'name="displayName"', { username: newName, displayName: "Reader A" });
  const { data: prof } = await service.from("profiles").select("username, display_name").eq("id", a.id).single();
  check("A reader can change their username and display name", prof?.username === newName && prof?.display_name === "Reader A", JSON.stringify(prof));
  const taken = await submitForm("/account", a.cookie, 'name="displayName"', { username: b.username, displayName: "" });
  check("A taken username is refused", taken.html.includes("That username is taken."));
  const invalid = await submitForm("/account", a.cookie, 'name="displayName"', { username: "No Spaces!", displayName: "" });
  check("An invalid username is refused", invalid.html.includes("lowercase letters, numbers or _"));

  const mismatch = await submitForm("/account", a.cookie, 'name="confirm"', { password: "abcdefgh1", confirm: "different1" });
  check("Password change needs matching passwords", mismatch.html.includes("Passwords don"));
  const newPassword = `${randomUUID()}Bb2!`;
  const changed = await submitForm("/account", a.cookie, 'name="confirm"', { password: newPassword, confirm: newPassword });
  const relogin = await createClient(url, publishableKey, noSession).auth.signInWithPassword({ email: a.email, password: newPassword });
  check("Password change works (can log in with the new one)", changed.html.includes("Password changed.") && !relogin.error, relogin.error?.message);

  // Data export
  await callAction(comicPath, "setFavorite", LIB, [comic.id, true], a.cookie);
  await callAction(comicPath, "setBookmark", LIB, [comic.id, true], b.cookie);
  const exportRes = await fetch(`${base}/account/export`, { headers: { cookie: a.cookie } });
  const exported = await exportRes.json().catch(() => null);
  check(
    "'Download my data' returns only their own data, as a file",
    exportRes.headers.get("content-disposition")?.includes("attachment") && exported?.account?.username === newName && exported?.bookmarks?.length === 1 && exported.bookmarks[0].favorite === true,
    JSON.stringify(exported).slice(0, 200),
  );
  check("…and logged-out visitors get nothing", (await fetch(`${base}/account/export`)).status === 401);

  // Admin: user roles
  const usersPage = await page("/admin/users", owner.cookie);
  check("The owner sees the user list", usersPage.html.includes(newName));
  await submitForm("/admin/users", owner.cookie, `aria-label="Make ${newName} an admin"`, {}, usersPage.html);
  const { data: granted } = await service.from("admin_permissions").select("role, granted_by").eq("user_id", a.id).maybeSingle();
  check("The owner can make a reader an admin", granted?.role === "admin" && granted?.granted_by === owner.id, JSON.stringify(granted));
  const ownerView = (await page("/admin/users", owner.cookie)).html;
  await submitForm("/admin/users", admin.cookie, `aria-label="Remove admin from ${newName}"`, {}, ownerView);
  check("A non-owner admin replaying the button changes nothing", Boolean((await service.from("admin_permissions").select("role").eq("user_id", a.id).maybeSingle()).data));
  await submitForm("/admin/users", owner.cookie, `aria-label="Remove admin from ${newName}"`, {}, ownerView);
  check("The owner can remove admin rights", !(await service.from("admin_permissions").select("role").eq("user_id", a.id).maybeSingle()).data);
  const readerUsers = await page("/admin/users", b.cookie);
  check("A reader gets 'not found' for Admin › Users", readerUsers.html.includes('<meta name="robots" content="noindex"/>') && !readerUsers.html.includes(newName));
} catch (err) {
  check("Test ran to completion", false, err.message);
} finally {
  if (created.comics.length) await service.from("comics").delete().in("id", created.comics);
  for (const id of created.users) await service.auth.admin.deleteUser(id);
}

for (const r of results) console.log(`${r.passed ? "PASS" : "FAIL"}  ${r.name}${r.passed || !r.detail ? "" : `\n      got: ${r.detail}`}`);
const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
