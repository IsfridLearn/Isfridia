import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

// Supabase client for Server Components, Server Actions and Route Handlers.
// It acts as the logged-in user (from the session cookie), so Row Level
// Security applies to everything it does. Create a new one per request.
export async function createClient() {
  // Read cookies first: this marks the caller as per-request, so Next.js waits
  // for a real visitor instead of running it during the build.
  const cookieStore = await cookies();

  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Fill in .env.local (see README.md), then restart `npm run dev`.",
    );
  }

  return createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. That's fine: src/proxy.ts
          // refreshes the session on every request before pages render.
        }
      },
    },
  });
}
