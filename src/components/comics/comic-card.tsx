import Link from "next/link";
import type { ComicCard as ComicCardData } from "@/lib/catalog/queries";
import { CoverArt } from "./cover-art";
import { StatusBadge } from "./status-badge";

// Cover + title + latest chapter + first genre. Used in every grid.
export function ComicCard({ comic, rank }: { comic: ComicCardData; rank?: number }) {
  return (
    <Link href={`/comics/${comic.slug}`} className="group flex min-w-0 flex-col gap-2.5">
      <div className="relative transition-transform duration-200 group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <CoverArt
          title={comic.title}
          slug={comic.slug}
          coverKey={comic.coverKey}
          decorative
          className="transition duration-200 group-hover:shadow-[0_18px_40px_rgba(0,0,0,0.45)] group-hover:brightness-110"
        />
        <StatusBadge status={comic.status} className="absolute top-2 left-2" />
        {rank ? (
          <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-lg bg-canvas/80 font-display text-sm font-extrabold">
            {rank}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <span className="line-clamp-2 text-sm leading-snug font-semibold text-fg group-hover:text-accent-fg">
          {comic.title}
        </span>
        <span className="flex justify-between gap-2 text-xs text-muted">
          <span>{comic.latestChapter ? `Ch. ${comic.latestChapter}` : "No chapters yet"}</span>
          <span className="truncate">{comic.genres[0]?.name}</span>
        </span>
      </div>
    </Link>
  );
}

export function ComicGrid({ comics, ranked = false }: { comics: ComicCardData[]; ranked?: boolean }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
      {comics.map((comic, i) => (
        <ComicCard key={comic.id} comic={comic} rank={ranked ? i + 1 : undefined} />
      ))}
    </div>
  );
}

export function ComicGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2.5">
          <div className="aspect-[2/3] animate-pulse rounded-xl bg-surface motion-reduce:animate-none" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-surface motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
