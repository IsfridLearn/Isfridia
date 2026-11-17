"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav";

// Main navigation. Highlights the current section. On phones it becomes a
// horizontally scrollable row under the logo.
export function NavLinks() {
  return <NavList pathname={usePathname()} />;
}

// The same menu without reading the URL. Used as the instant placeholder
// while the current address is still unknown (pages with [slug] in the path).
export function NavList({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Main"
      className="order-last -mx-1 flex w-full gap-0.5 overflow-x-auto [scrollbar-width:none] md:order-none md:mx-0 md:w-auto md:flex-1"
    >
      {NAV.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2.5 text-sm transition ${
              active ? "bg-surface-2 font-semibold text-fg" : "font-medium text-muted hover:text-fg"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
