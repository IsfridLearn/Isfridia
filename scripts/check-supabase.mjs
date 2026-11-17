// Checks that .env.local is filled in and that Supabase accepts the keys.
// Run with: npm run check:supabase
// It calls Supabase's public auth health endpoint and prints only pass/fail
// details; it never prints your keys.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

const problems = [];

if (!url) {
  problems.push("NEXT_PUBLIC_SUPABASE_URL is empty.");
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  problems.push(
    "NEXT_PUBLIC_SUPABASE_URL should look like https://<project-ref>.supabase.co",
  );
}

if (!publishableKey) {
  problems.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is empty.");
} else if (publishableKey.startsWith("sb_secret_")) {
  problems.push(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds a SECRET key. Swap it for the sb_publishable_ key; secret keys must never use the NEXT_PUBLIC_ prefix.",
  );
}

if (secretKey && !secretKey.startsWith("sb_secret_")) {
  problems.push("SUPABASE_SECRET_KEY should start with sb_secret_ (or stay empty for now).");
}

if (problems.length > 0) {
  console.error("Supabase setup is not ready:");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("\nCopy .env.example to .env.local and fill in the values.");
  process.exit(1);
}

const endpoint = `${url.replace(/\/$/, "")}/auth/v1/health`;

try {
  const res = await fetch(endpoint, { headers: { apikey: publishableKey } });
  if (res.ok) {
    console.log(`OK: Supabase answered (HTTP ${res.status}) and accepted the publishable key.`);
    process.exit(0);
  }
  console.error(`Supabase answered with HTTP ${res.status}.`);
  if (res.status === 401 || res.status === 403) {
    console.error("The key was rejected. Re-copy the publishable key from the dashboard.");
  }
  process.exit(1);
} catch (err) {
  console.error(`Could not reach ${url}: ${err instanceof Error ? err.message : err}`);
  console.error("Check the project URL, your internet connection, and that the project is not paused.");
  process.exit(1);
}
