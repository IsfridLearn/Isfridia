import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

// Supabase client for PUBLIC data (comics, chapters, genres) that everyone sees.
// It never reads cookies, so it acts as a logged-out visitor: Row Level
// Security only lets it see published content. That is also what makes its
// results safe to cache and share between all visitors.
export function createPublicClient() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error("Supabase is not configured. Fill in .env.local (see README.md).");
  }
  return createClient<Database>(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
