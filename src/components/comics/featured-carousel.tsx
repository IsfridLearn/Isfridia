"use client";

import Link from "next/link";
import { useState } from "react";
import type { ComicCard } from "@/lib/catalog/queries";
import { CoverArt, coverColour } from "./cover-art";
import { StatusBadge } from "./status-badge";

// The big banner at the top of the homepage. Arrows and dots switch between
// featured comics. It never moves on its own (auto-sliding is hard to read and
// to use with a keyboard or screen reader).
export function FeaturedCarousel({ items }: { items: ComicCard[] }) {
  const [index, setIndex] = useState(0);
  const comic = items[index];
  if (!comic) return null;
  const go = (delta: number) => setIndex((i) => (i + delta + items.length) % items.length);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured comics"
      className="relative flex min-h-[400px] flex-wrap overflow-hidden rounded-[22px]"
      style={{ backgroundColor: coverColour(comic.slug) }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 14px)" }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-canvas from-0% via-canvas/85 via-45% to-canvas/25" />

      <div
        aria-live="polite"
        className="relative flex min-w-0 flex-[999_1_420px] flex-col justify-center gap-4 px-6 pt-10 pb-24 sm:px-12"
      >
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold tracking-wider text-accent-fg uppercase">
            Featured
          </span>
          <StatusBadge status={comic.status} className="rounded-full px-2.5 py-1 text-xs" />
        </div>
        <h2 className="max-w-[600px] font-display text-4xl leading-none font-extrabold tracking-tight sm:text-[56px]">
          {comic.title}
        </h2>
        {comic.genres.length ? (
          <p className="text-sm font-medium text-fg-soft">{comic.genres.map((g) => g.name).join(" · ")}</p>
        ) : null}
        <p className="line-clamp-3 max-w-[520px] text-base text-muted">{comic.synopsis}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <Link
            href={`/comics/${comic.slug}`}
            className="flex h-12 items-center rounded-xl bg-accent px-6 font-bold text-on-accent transition hover:brightness-110"
          >
            View comic
          </Link>
          {comic.latestChapter ? (
            <span className="text-sm text-muted">
              Chapter {comic.latestChapter}
              {comic.latestAgo ? ` · updated ${comic.latestAgo}` : ""}
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative hidden flex-[1_1_280px] items-center justify-center px-12 pt-9 pb-24 md:flex">
        <CoverArt
          title={comic.title}
          slug={comic.slug}
          coverKey={comic.coverKey}
          sizes="220px"
          priority
          decorative
          titleClassName="text-2xl"
          className="w-[220px] -rotate-[2.5deg] shadow-[0_30px_70px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
        />
      </div>

      {items.length > 1 ? (
        <div className="absolute inset-x-4 bottom-4 flex items-center justify-between sm:inset-x-8">
          <div className="flex">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show ${item.title}`}
                aria-current={i === index ? "true" : undefined}
                className="flex size-11 items-center justify-center"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all ${i === index ? "w-7 bg-accent" : "w-2 bg-white/35"}`}
                />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <ArrowButton label="Previous featured comic" onClick={() => go(-1)} direction="left" />
            <ArrowButton label="Next featured comic" onClick={() => go(1)} direction="right" />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ArrowButton({ label, onClick, direction }: { label: string; onClick: () => void; direction: "left" | "right" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-canvas/55 text-fg transition hover:bg-canvas/80"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
      </svg>
    </button>
  );
}
