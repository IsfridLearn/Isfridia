import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { NavLinks, NavList } from "./nav-links";
import { UserMenu } from "./user-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 sm:px-6">
        <Link href="/" aria-label="IsfridVerse home" className="flex items-center gap-2.5">
          <LogoMark />
          <Wordmark className="text-[22px]" />
        </Link>
        <Suspense fallback={<NavList pathname="" />}>
          <NavLinks />
        </Suspense>
        <div className="ml-auto flex items-center gap-2">
          <Form action="/search" role="search" className="relative">
            <label htmlFor="site-search" className="sr-only">
              Search comics
            </label>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none absolute top-[11.5px] left-3 text-faint">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              id="site-search"
              name="q"
              type="search"
              placeholder="Search titles, authors…"
              maxLength={100}
              className="h-10 w-36 rounded-[10px] border border-line-strong bg-surface pr-3 pl-9 text-sm text-fg placeholder:text-faint sm:w-64"
            />
          </Form>
          <Suspense fallback={<div className="h-10 w-10 sm:w-[150px]" aria-hidden="true" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
