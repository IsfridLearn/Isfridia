"use client";

import Link from "next/link";
import { useState } from "react";
import type { RankedLists } from "@/lib/catalog/queries";
import { CoverArt } from "./cover-art";

const TABS = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All time" },
] as const;

// Ranked sidebar on the homepage. All three lists arrive with the page, so
// switching tabs is instant.
export function TrendingList({ lists }: { lists: RankedLists }) {
  const [tab, setTab] = useState<keyof RankedLists>("week");
  const items = lists[tab];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="trending-heading" className="flex items-center gap-2 font-display text-[22px] font-bold tracking-tight">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
          </svg>
          Trending
        </h2>
        <div className="flex gap-0.5 rounded-[10px] border border-line bg-surface p-[3px]" role="group" aria-label="Time period">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={`h-[34px] rounded-[7px] px-3 text-[13px] font-semibold transition ${
                tab === t.id ? "bg-line-strong text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {items.length ? (
        <ol className="flex flex-col gap-1">
          {items.map((comic, i) => (
            <li key={comic.id}>
              <Link href={`/comics/${comic.slug}`} className="flex items-center gap-3.5 rounded-xl px-2.5 py-2 transition hover:bg-surface-2">
                <span className={`w-7 shrink-0 text-center font-display text-2xl font-extrabold ${i < 3 ? "text-accent" : "text-faint"}`}>
                  {i + 1}
                </span>
                <CoverArt title={comic.title} slug={comic.slug} coverKey={comic.coverKey} sizes="48px" decorative showTitle={false} className="w-12 shrink-0 rounded-[7px]" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">{comic.title}</span>
                  <span className="text-xs text-muted">
                    {comic.latestChapter ? `Ch. ${comic.latestChapter}` : "No chapters yet"}
                    {comic.genres[0] ? ` · ${comic.genres[0].name}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">Nothing ranked yet.</p>
      )}
    </div>
  );
}
