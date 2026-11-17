import "server-only";

import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Two locks protect admin features: these checks in the app, and the
// database's Row Level Security rules on every query.

async function adminSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) return { supabase, userId: null, isAdmin: false };
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  return { supabase, userId: data.claims.sub, isAdmin: !error && isAdmin === true };
}

// For admin PAGES. Always renders per request (pages read the session and the
// clock). Logged-out visitors go to the login page; logged-in non-admins get a
// plain 404, so the admin area isn't confirmed to exist. `now` is this
// request's time, for "5 minutes ago" labels.
export async function requireAdminPage(returnTo: string) {
  await connection();
  const { supabase, userId, isAdmin } = await adminSession();
  if (!userId) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!isAdmin) notFound();
  return { supabase, userId, now: Date.now() };
}

// For admin ACTIONS (form submissions). Returns null for anyone who isn't an
// admin; the action then stops without doing anything.
export async function adminForAction() {
  const { supabase, userId, isAdmin } = await adminSession();
  return userId && isAdmin ? { supabase, userId } : null;
}
