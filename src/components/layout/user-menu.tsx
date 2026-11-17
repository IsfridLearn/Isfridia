import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Right side of the header: "Log in / Sign up" or a link to your account.
// It reads the session cookie, so it renders per visitor inside <Suspense>,
// while the rest of the header stays cached and instant.
export async function UserMenu() {
  // Per-visitor and time-dependent (session expiry): never pre-build it.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data) {
    const initial = (data.claims.email ?? "?").charAt(0).toUpperCase();
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href="/bookmarks"
          aria-label="Bookmarks"
          title="Bookmarks"
          className="flex size-10 items-center justify-center rounded-[10px] text-fg-soft transition hover:bg-surface-2 hover:text-fg"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </Link>
        <Link
          href="/account"
          aria-label="Your account"
          className="flex size-10 items-center justify-center rounded-full bg-line-strong text-sm font-bold transition hover:bg-surface-2"
        >
          {initial}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link href="/login" className="flex h-10 items-center rounded-[10px] px-3 text-sm font-semibold hover:bg-surface-2">
        Log in
      </Link>
      <Link
        href="/register"
        className="flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-bold text-on-accent transition hover:brightness-110"
      >
        Sign up
      </Link>
    </div>
  );
}
