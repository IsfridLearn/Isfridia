import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Server-only client with the SECRET key. It bypasses Row Level Security, so
// it is used for exactly one thing: counting chapter views after the server's
// own checks (src/app/api/views/route.ts). Never import it in browser code.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("SUPABASE_SECRET_KEY is not set (see .env.example).");
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
