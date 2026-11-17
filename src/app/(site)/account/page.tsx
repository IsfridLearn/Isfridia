import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/(auth)/actions";
import { requireUserPage } from "@/lib/auth/require-user";
import { PasswordForm, ProfileForm } from "./account-forms";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Your account</h1>
      {/* Reading the session happens per request, so it streams in. */}
      <Suspense fallback={<p className="text-muted">Loading your account…</p>}>
        <AccountDetails />
      </Suspense>
    </div>
  );
}

async function AccountDetails() {
  const { supabase, userId, email } = await requireUserPage("/account");
  const [{ data: profile }, { data: isAdmin }, { count: bookmarks }, { count: chaptersRead }] = await Promise.all([
    supabase.from("profiles").select("username, display_name, created_at").eq("id", userId).single(),
    supabase.rpc("is_admin"),
    supabase.from("bookmarks").select("comic_id", { count: "exact", head: true }),
    supabase.from("reading_history").select("chapter_id", { count: "exact", head: true }),
  ]);

  const card = "rounded-2xl border border-line bg-surface p-5";
  const link = "flex h-11 items-center justify-between rounded-xl border border-line-strong bg-panel px-4 font-semibold transition hover:bg-surface-2";

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
        <Detail label="Username" value={profile?.username ?? "-"} />
        <Detail label="Email" value={email ?? "-"} />
        <Detail label="Member since" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en", { dateStyle: "medium" }) : "-"} />
        <Detail label="Role" value={isAdmin ? "Admin" : "Reader"} />
      </dl>

      <section aria-label="Your library" className="grid gap-3 sm:grid-cols-2">
        <Link href="/bookmarks" className={link}>
          Bookmarks <span className="text-sm font-normal text-muted">{bookmarks ?? 0}</span>
        </Link>
        <Link href="/history" className={link}>
          Reading history <span className="text-sm font-normal text-muted">{chaptersRead ?? 0} chapters</span>
        </Link>
        {isAdmin ? (
          <Link href="/admin" className={`${link} sm:col-span-2`}>
            Admin dashboard <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </section>

      <section aria-labelledby="profile-heading" className={card}>
        <h2 id="profile-heading" className="mb-4 font-display text-xl font-bold">Profile</h2>
        <ProfileForm username={profile?.username ?? ""} displayName={profile?.display_name ?? ""} />
      </section>

      <section aria-labelledby="password-heading" className={card}>
        <h2 id="password-heading" className="mb-4 font-display text-xl font-bold">Change password</h2>
        <PasswordForm />
      </section>

      <section aria-labelledby="data-heading" className={card}>
        <h2 id="data-heading" className="font-display text-xl font-bold">Your data</h2>
        <p className="mt-1 mb-4 text-sm text-muted">Download your profile, bookmarks and reading history as a file.</p>
        <a href="/account/export" className="inline-flex h-11 items-center rounded-xl border border-line-strong bg-panel px-4 font-semibold hover:bg-surface-2">
          Download my data
        </a>
      </section>

      <form action={signOut}>
        <button type="submit" className="h-11 rounded-xl border border-line-strong bg-surface px-5 font-semibold text-fg transition hover:bg-surface-2">
          Log out
        </button>
      </form>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel px-4 py-3.5">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 font-semibold break-all">{value}</dd>
    </div>
  );
}
