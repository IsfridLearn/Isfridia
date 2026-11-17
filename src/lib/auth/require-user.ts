import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

// For pages that need a logged-in reader (bookmarks, history, account).
// Renders per request; logged-out visitors go to the login page and come back.
// Queries run as that reader, so the database only ever returns their own data.
export async function requireUserPage(returnTo: string) {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return { supabase, userId: data.claims.sub, email: data.claims.email ?? null, now: Date.now() };
}

// For actions: the reader's session, or null if logged out.
export async function userForAction() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data ? { supabase, userId: data.claims.sub } : null;
}
