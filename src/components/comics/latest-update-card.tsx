import Link from "next/link";
import type { LatestUpdate } from "@/lib/catalog/queries";
import { chapterPath } from "@/lib/chapter-path";
import { CoverArt } from "./cover-art";
import { NewBadge } from "./status-badge";

// Homepage "Latest updates": cover, title, genres and the two newest chapters
// (each opens the reader).
export function LatestUpdateCard({ comic }: { comic: LatestUpdate }) {
  return (
    <article className="flex min-w-0 gap-3.5 rounded-[14px] border border-line bg-surface p-3">
      <Link href={`/comics/${comic.slug}`} tabIndex={-1} aria-hidden="true" className="w-[76px] shrink-0">
        <CoverArt title={comic.title} slug={comic.slug} coverKey={comic.coverKey} sizes="76px" decorative titleClassName="text-[11px]" className="rounded-[9px]" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link href={`/comics/${comic.slug}`} className="truncate text-[15px] font-semibold hover:text-accent-fg">
          {comic.title}
        </Link>
        <span className="-mt-1 truncate text-xs text-muted">{comic.genres.map((g) => g.name).join(" · ")}</span>
        <ul className="flex flex-col gap-1.5">
          {comic.chapters.map((ch) => (
            <li key={ch.number}>
              <Link
                href={chapterPath(comic.slug, ch.number)}
                className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[13px] font-medium transition hover:bg-line-strong"
              >
                <span className="flex items-center gap-2">
                  Chapter {ch.number}
                  {ch.isNew ? <NewBadge /> : null}
                </span>
                <span className="text-xs whitespace-nowrap text-muted">{ch.ago}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
