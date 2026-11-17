import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/(auth)/actions";
import { AdminNav, AdminNavList } from "@/components/admin/admin-nav";
import { LogoMark, Wordmark } from "@/components/brand/logo";

// Admin dashboard frame: sidebar on wide screens, a top section on phones.
// The frame itself shows nothing private; every admin page checks
// permissions with requireAdminPage() before loading any data.
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Isfridia" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="flex flex-col gap-5 border-b border-line bg-sunken px-4 py-4 lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0 lg:py-5">
        <Link href="/admin" className="flex items-center gap-2.5 px-1" aria-label="Admin overview">
          <LogoMark />
          <Wordmark className="text-lg" />
          <span className="ml-auto rounded-md bg-line px-2 py-0.5 text-[11px] font-bold tracking-wider text-fg-soft">ADMIN</span>
        </Link>
        <Suspense fallback={<AdminNavList pathname="" />}>
          <AdminNav />
        </Suspense>
        <div className="flex flex-wrap gap-1 lg:mt-auto lg:flex-col">
          <Link href="/" className="flex h-10 items-center rounded-[10px] px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
            View site ↗
          </Link>
          <form action={signOut}>
            <button type="submit" className="flex h-10 w-full items-center rounded-[10px] px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-7 sm:px-8">
        <div className="mx-auto max-w-[1100px]">{children}</div>
      </main>
    </div>
  );
}
