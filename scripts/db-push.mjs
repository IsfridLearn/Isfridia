// Applies the SQL files in supabase/migrations to the Isfridia database.
// Run with: npm run db:push            (apply)
//           npm run db:push -- --dry-run (only list what would be applied)
//
// Two ways to reach the database:
//   1. SUPABASE_DB_URL is set: connect with that connection string.
//   2. It is empty: use your `npx supabase login` session for the project in
//      NEXT_PUBLIC_SUPABASE_URL (no database password needed).
// Safety: only ever targets the project in NEXT_PUBLIC_SUPABASE_URL, refuses a
// database URL from a different project, and prints the target first.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const dbUrl = process.env.SUPABASE_DB_URL?.trim();
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

const apiRef = apiUrl?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/)?.[1];
if (!apiRef) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL in .env.local first (see README.md).");
  process.exit(1);
}

let remote = apiRef;
if (dbUrl) {
  // Session pooler: postgresql://postgres.<ref>:<password>@aws-...pooler.supabase.com:5432/postgres
  // Direct:         postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
  const dbRef =
    dbUrl.match(/^postgres(?:ql)?:\/\/postgres\.([a-z0-9]+):/)?.[1] ??
    dbUrl.match(/@db\.([a-z0-9]+)\.supabase\.co/)?.[1];
  if (dbRef !== apiRef) {
    console.error(`Refusing to run: the API URL is project "${apiRef}" but the database URL is project "${dbRef ?? "unknown"}".`);
    console.error("Both must come from the Isfridia project.");
    process.exit(1);
  }
  remote = dbUrl;
}

console.log(`Target Supabase project: ${apiRef} (${dbUrl ? "database URL" : "CLI login"})`);

const cli = fileURLToPath(new URL("../node_modules/supabase/dist/supabase.js", import.meta.url));
const extra = process.argv.slice(2);
const result = spawnSync(
  process.execPath,
  [cli, "db", "push", `--remote=${remote}`, "--yes", ...extra],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
