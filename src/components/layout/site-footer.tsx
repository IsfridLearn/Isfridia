import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { NAV } from "./nav";

export function SiteFooter() {
  const linkClass = "text-fg-soft hover:text-accent-fg";
  return (
    <footer className="mt-20 border-t border-line bg-sunken">
      <div className="mx-auto flex max-w-[1280px] flex-wrap gap-10 px-4 py-12 sm:px-6">
        <div className="flex flex-[2_1_260px] flex-col gap-3">
          <Wordmark className="text-2xl" />
          <p className="max-w-xs text-sm text-muted">Original manhwa, published by the people who make it.</p>
        </div>
        <nav aria-label="Browse" className="flex flex-[1_1_140px] flex-col gap-2.5 text-sm">
          <span className="text-xs font-bold tracking-widest text-faint uppercase">Browse</span>
          {NAV.slice(1).map((item) => (
            <Link key={item.href} href={item.href} className={linkClass}>
              {item.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Account" className="flex flex-[1_1_140px] flex-col gap-2.5 text-sm">
          <span className="text-xs font-bold tracking-widest text-faint uppercase">Account</span>
          <Link href="/account" className={linkClass}>
            Your account
          </Link>
          <Link href="/bookmarks" className={linkClass}>
            Bookmarks
          </Link>
          <Link href="/history" className={linkClass}>
            Reading history
          </Link>
          <Link href="/login" className={linkClass}>
            Log in
          </Link>
          <Link href="/register" className={linkClass}>
            Create account
          </Link>
        </nav>
      </div>
      <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-2 border-t border-line px-4 py-5 text-[13px] text-faint sm:px-6">
        <span>© 2026 Isfridia</span>
        <span>
          Catalog data and official chapter links via{" "}
          <a href="https://mangadex.org" target="_blank" rel="noopener noreferrer" className="text-fg-soft underline hover:text-accent-fg">
            MangaDex
          </a>{" "}
          and{" "}
          <a href="https://www.mangaupdates.com" target="_blank" rel="noopener noreferrer" className="text-fg-soft underline hover:text-accent-fg">
            MangaUpdates
          </a>
          . Covers and titles belong to their creators and publishers.
        </span>
      </div>
    </footer>
  );
}
