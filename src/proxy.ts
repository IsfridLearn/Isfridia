import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Runs before each page request. Its only job: keep the login session fresh.
// Supabase access tokens expire after a while; this swaps in a new one using
// the refresh token and writes the updated cookies to the response.
// It does NOT decide who may see what. Pages and the database (RLS) do that.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = getSupabaseEnv();
  if (!env) return response; // Supabase not set up yet: nothing to refresh.

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Stops CDNs from caching a response that carries someone's session.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Verifies the session and refreshes it if needed. Must run before returning.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  // Skip static files and images; they never need a session.
  matcher: ["/((?!_next/static|_next/image|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)"],
};
