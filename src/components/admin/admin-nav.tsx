"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Admin sections. Chapters are managed from each comic (Comics → a comic →
// Chapters). Only sections that exist are listed.
const ITEMS = [
  { href: "/admin", label: "Overview", icon: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" },
  { href: "/admin/comics", label: "Comics", icon: "M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" },
  { href: "/admin/genres", label: "Genres", icon: "M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4zM7.5 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" },
  { href: "/admin/users", label: "Users", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/admin/mangaupdates", label: "Import metadata", icon: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" },
  { href: "/admin/trash", label: "Trash", icon: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" },
] as const;

export function AdminNav() {
  return <AdminNavList pathname={usePathname()} />;
}

export function AdminNavList({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-1 lg:flex-col">
      {ITEMS.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm transition ${
              active ? "bg-surface-2 font-semibold text-fg" : "font-medium text-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={active ? "text-accent" : ""}>
              <path d={item.icon} />
            </svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
