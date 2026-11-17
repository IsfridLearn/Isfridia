import Link from "next/link";
import { getTrendingThisWeek, type TrendingEntry } from "@/lib/catalog/queries";
import { formatCount, trendingNote, type Movement } from "@/lib/catalog/trending";
import { SectionHeading } from "@/components/ui/section-heading";
import { CoverArt } from "./cover-art";

// "Trending This Week" on the homepage: top 10 manhwa by MangaDex followers
// gained over the last 7 days (daily snapshots; see lib/catalog/trending.ts).
// Uses the same card look as ComicCard. Wrapped in <Suspense> by the page.

const GRID = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

export async function TrendingThisWeek() {
  // A failure here must never break the rest of the homepage.
  const data = await getTrendingThisWeek(10).catch(() => null);

  return (
    <section aria-labelledby="trending-week-heading">
      <SectionHeading id="trending-week-heading" href="/popular" linkLabel="All popular">
        Trending This Week
      </SectionHeading>
      {data === null ? (
        <p role="status" className="-mt-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          Trending couldn&apos;t be loaded right now. It will be back shortly.
        </p>
      ) : data.items.length === 0 ? (
        <p className="-mt-2 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
          No manhwa to rank yet. The ranking appears once MangaDex titles are in the catalog.
        </p>
      ) : (
        <>
          <p className="-mt-2 mb-4 text-sm text-muted">{trendingNote(data.mode, data.windowStart, data.windowEnd)}</p>
          <ol className={GRID}>
            {data.items.map((item) => (
              <li key={item.id} className="min-w-0">
                <TrendingCard item={item} />
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

function TrendingCard({ item }: { item: TrendingEntry }) {
  const genres = item.genres.slice(0, 2).map((g) => g.name).join(" · ");
  const stat = item.gain != null ? `+${formatCount(item.gain)} followers` : `${formatCount(item.follows)} followers`;
  return (
    <Link href={`/comics/${item.slug}`} className="group flex min-w-0 flex-col gap-2.5">
      <div className="relative transition-transform duration-200 group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <CoverArt
          title={item.title}
          slug={item.slug}
          coverKey={item.coverKey}
          decorative
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 220px"
          className="transition duration-200 group-hover:shadow-[0_18px_40px_rgba(0,0,0,0.45)] group-hover:brightness-110"
        />
        <span
          className={`absolute top-2 left-2 flex h-7 min-w-7 items-center justify-center rounded-lg bg-canvas/80 px-1.5 font-display text-sm font-extrabold ${
            item.rank <= 3 ? "text-accent" : "text-fg"
          }`}
        >
          <span className="sr-only">Rank </span>#{item.rank}
        </span>
        <MovementBadge movement={item.movement} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="line-clamp-2 text-sm leading-snug font-semibold text-fg group-hover:text-accent-fg">{item.title}</span>
        {genres ? <span className="truncate text-xs text-muted">{genres}</span> : null}
        <span className="text-xs font-medium text-fg-soft">{stat}</span>
      </div>
    </Link>
  );
}

function MovementBadge({ movement }: { movement: Movement }) {
  if (!movement) return null;
  const base = "absolute top-2 right-2 flex h-7 items-center gap-0.5 rounded-lg bg-canvas/80 px-2 text-xs font-bold";
  switch (movement.kind) {
    case "up":
      return (
        <span className={`${base} text-ongoing`} title={`Up from #${movement.from} last week`}>
          <span aria-hidden="true">▲</span>
          {movement.by}
          <span className="sr-only">, up from number {movement.from} last week</span>
        </span>
      );
    case "down":
      return (
        <span className={`${base} text-danger`} title={`Down from #${movement.from} last week`}>
          <span aria-hidden="true">▼</span>
          {movement.by}
          <span className="sr-only">, down from number {movement.from} last week</span>
        </span>
      );
    case "same":
      return (
        <span className={`${base} text-muted`} title="Same rank as last week">
          <span aria-hidden="true">–</span>
          <span className="sr-only">Same rank as last week</span>
        </span>
      );
    case "new":
      return (
        <span className={`${base} text-accent-fg`} title="New in the ranking this week">
          New
        </span>
      );
  }
}

export function TrendingThisWeekSkeleton() {
  return (
    <section aria-label="Trending This Week (loading)" aria-busy="true">
      <div className="mb-4 h-7 w-56 animate-pulse rounded bg-surface motion-reduce:animate-none" />
      <div aria-hidden="true" className={GRID}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <div className="aspect-[2/3] animate-pulse rounded-xl bg-surface motion-reduce:animate-none" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-surface motion-reduce:animate-none" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </section>
  );
}
