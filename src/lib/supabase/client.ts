"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Supabase client for the BROWSER. It uses the logged-in user's session (from
// cookies), so Row Level Security applies exactly as on the server. Used by
// the chapter page uploader to send files straight to storage.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
  );
}
