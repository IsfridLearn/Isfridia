// End-to-end check of /admin/mangaupdates against a RUNNING site.
// Run the site first (npm run build && npm run start), then: npm run test:admin
// Optional: BASE_URL (default http://localhost:3000).
//
// Uses temporary users (a reader and an admin) and makes a few real requests
// to the public MangaUpdates API (spaced out by the app itself). Deletes the
// users at the end.

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
const created = [];
const results = [];
const check = (name, passed, detail = "") => results.push({ name, passed: Boolean(passed), detail });

async function sessionCookie(tag, makeAdmin) {
  const email = `adm-${tag}-${run}@example.com`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: `${randomUUID()}Aa1!`,
    email_confirm: true,
    user_metadata: { username: `t_${tag}_${run}` },
  });
  if (error) throw new Error(`create ${tag}: ${error.message}`);
  created.push(data.user.id);
  if (makeAdmin) {
    const { error: e } = await service.from("admin_permissions").insert({ user_id: data.user.id, role: "admin" });
    if (e) throw new Error(`grant admin: ${e.message}`);
  }
  const { data: link, error: linkErr } = await service.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr) throw new Error(`link ${tag}: ${linkErr.message}`);
  const res = await fetch(`${base}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/account`, {
    redirect: "manual",
  });
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => !c.endsWith("="))
    .join("; ");
}

const page = async (path, cookie) => (await fetch(`${base}${path}`, { headers: cookie ? { cookie } : {} })).text();

try {
  const anonHtml = await page("/admin/mangaupdates");
  check(
    "Logged-out visitor is sent to /login (with a return link)",
    anonHtml.includes("/login?next=%2Fadmin%2Fmangaupdates") && !anonHtml.includes('id="mu-q"'),
  );

  const readerCookie = await sessionCookie("reader", false);
  const readerHtml = await page("/admin/mangaupdates?q=solo%20leveling", readerCookie);
  check(
    "Logged-in non-admin gets 'not found' and no tool",
    readerHtml.includes('<meta name="robots" content="noindex"/>') && !readerHtml.includes('id="mu-q"') && !readerHtml.includes("Preview import"),
  );

  const adminCookie = await sessionCookie("admin", true);
  const tool = await page("/admin/mangaupdates", adminCookie);
  check("Admin sees the search box", tool.includes('id="mu-q"'));

  const first = await page(`/admin/mangaupdates?q=${encodeURIComponent("solo leveling")}`, adminCookie);
  check("Admin search returns real MangaUpdates results", first.includes("Solo Leveling") && first.includes("Preview import"));

  const second = await page(`/admin/mangaupdates?q=${encodeURIComponent("Solo   Leveling")}`, adminCookie);
  check("Same search again (different spacing/case) is served from the cache", second.includes("(from cache)"));

  const preview = await page(`/admin/mangaupdates?q=${encodeURIComponent("solo leveling")}&id=15180124327`, adminCookie);
  check(
    "Import preview maps the series (title, author, status, credit link)",
    preview.includes("Import preview") &&
      preview.includes("Chugong") &&
      preview.includes("Completed") &&
      preview.includes("View on MangaUpdates") &&
      preview.includes("Rewrite it in your own words"),
  );

  const bogus = await page(`/admin/mangaupdates?q=${encodeURIComponent("solo leveling")}&id=not-a-number`, adminCookie);
  check("A malformed id falls back to the search results", bogus.includes("Preview import") && !bogus.includes("Import preview"));
} catch (err) {
  check("Test ran to completion", false, err.message);
} finally {
  for (const id of created) await service.auth.admin.deleteUser(id);
}

for (const r of results) console.log(`${r.passed ? "PASS" : "FAIL"}  ${r.name}${r.passed || !r.detail ? "" : `\n      got: ${r.detail}`}`);
const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
