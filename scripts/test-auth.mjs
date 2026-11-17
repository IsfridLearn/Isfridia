// End-to-end check of the email-link login path against a RUNNING site.
// Run the site first (npm run build && npm run start), then: npm run test:auth
// Optional: BASE_URL=http://localhost:3000 (default).
//
// Creates a temporary confirmed user, asks Supabase for a real one-time login
// link, follows it through /auth/confirm, then loads /account with the session
// cookie it received. Deletes the user at the end.

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
const email = `auth-${run}@example.com`;
const username = `t_auth_${run}`;
const results = [];
const check = (name, passed, detail = "") => results.push({ name, passed: Boolean(passed), detail });
let userId;

// Collect "name=value" pairs from Set-Cookie headers.
const cookieHeader = (res) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => !c.endsWith("="))
    .join("; ");

try {
  const { data: created, error } = await service.auth.admin.createUser({
    email,
    password: `${randomUUID()}Aa1!`,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) throw new Error(`create user: ${error.message}`);
  userId = created.user.id;

  // 1. Bad link is rejected.
  const bad = await fetch(`${base}/auth/confirm?token_hash=not-a-real-token&type=magiclink&next=/account`, {
    redirect: "manual",
  });
  check(
    "A fake email link is rejected and sent to /login?error=link",
    bad.status >= 300 && bad.status < 400 && bad.headers.get("location")?.includes("/login?error=link"),
    `${bad.status} ${bad.headers.get("location")}`,
  );

  // 2. Open-redirect attempt is neutralised.
  const { data: link1, error: linkErr1 } = await service.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr1) throw new Error(`generate link: ${linkErr1.message}`);
  const evil = await fetch(
    `${base}/auth/confirm?token_hash=${link1.properties.hashed_token}&type=magiclink&next=//evil.example`,
    { redirect: "manual" },
  );
  const evilLocation = evil.headers.get("location") ?? "";
  check(
    "A link with next=//evil.example stays on this site",
    !evilLocation.includes("evil.example") && evilLocation.includes("/account"),
    `${evil.status} ${evilLocation}`,
  );

  // 3. A real link logs the user in.
  const { data: link2, error: linkErr2 } = await service.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr2) throw new Error(`generate link: ${linkErr2.message}`);
  const good = await fetch(
    `${base}/auth/confirm?token_hash=${link2.properties.hashed_token}&type=magiclink&next=/account`,
    { redirect: "manual" },
  );
  const cookies = cookieHeader(good);
  check(
    "A real email link redirects to /account",
    good.status >= 300 && good.status < 400 && good.headers.get("location")?.endsWith("/account"),
    `${good.status} ${good.headers.get("location")}`,
  );
  check("…and sets a Supabase session cookie", /sb-[a-z0-9]+-auth-token/.test(cookies), cookies.slice(0, 60));

  // 4. /account shows the logged-in user.
  const account = await fetch(`${base}/account`, { headers: { cookie: cookies } });
  const html = await account.text();
  check("/account shows the logged-in user's username", account.ok && html.includes(username), `${account.status}`);
  check("/account shows the Log out button", html.includes("Log out"), "");

  // 5. Without the cookie, /account does not show the user.
  const anonymous = await fetch(`${base}/account`);
  const anonHtml = await anonymous.text();
  check(
    "/account without a session does not show the user (sends to /login)",
    !anonHtml.includes(username) && anonHtml.includes("/login"),
    `${anonymous.status}`,
  );
} catch (err) {
  check("Test ran to completion", false, err.message);
} finally {
  if (userId) await service.auth.admin.deleteUser(userId);
}

for (const r of results) {
  console.log(`${r.passed ? "PASS" : "FAIL"}  ${r.name}${r.passed ? "" : `\n      got: ${r.detail}`}`);
}
const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
