import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BookmarkButtons } from "@/components/comics/bookmark-buttons";
import { ComicGrid } from "@/components/comics/comic-card";
import { CoverArt, coverColour } from "@/components/comics/cover-art";
import { NewBadge, StatusBadge } from "@/components/comics/status-badge";
import { EmptyState } from "@/components/ui/section-heading";
import { getComic } from "@/lib/catalog/queries";
import { chapterPath } from "@/lib/chapter-path";
import { STATUS_LABEL, TYPE_LABEL, chapterNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getBookmarkState } from "@/lib/user/library";

export async function generateMetadata({ params }: PageProps<"/comics/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const comic = await getComic(slug);
  if (!comic) return { title: "Comic not found" };
  return {
    title: comic.title,
    description: comic.synopsis.slice(0, 160) || `Read ${comic.title} on Isfridia.`,
  };
}

export default function ComicPage({ params }: PageProps<"/comics/[slug]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ComicDetails params={params} />
    </Suspense>
  );
}

async function ComicDetails({ params }: { params: PageProps<"/comics/[slug]">["params"] }) {
  const { slug } = await params;
  const comic = await getComic(slug);
  if (!comic) notFound();

  const meta = [
    { label: "Author", value: comic.author },
    { label: "Artist", value: comic.artist },
    { label: "Status", value: STATUS_LABEL[comic.status] },
    { label: "Released", value: comic.releaseYear ? String(comic.releaseYear) : null },
    { label: "Latest", value: comic.latestChapter ? `Chapter ${comic.latestChapter}` : null },
    { label: "Updated", value: comic.latestAgo },
  ].filter((m): m is { label: string; value: string } => Boolean(m.value));

  return (
    <div className="relative">
      {/* Tinted backdrop in the cover's colour, fading into the page. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[380px] overflow-hidden" style={{ backgroundColor: coverColour(comic.slug) }}>
        <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 14px)" }} />
        <div className="absolute inset-0 bg-linear-to-b from-canvas/55 via-canvas/85 via-55% to-canvas" />
      </div>

      <div className="relative mx-auto max-w-[1280px] px-4 pt-8 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-6 text-[13px] text-muted">
          <Link href="/" className="text-fg-soft hover:text-accent-fg">Home</Link>
          <span aria-hidden="true" className="mx-2">/</span>
          <Link href="/comics" className="text-fg-soft hover:text-accent-fg">Comics</Link>
          <span aria-hidden="true" className="mx-2">/</span>
          <span aria-current="page">{comic.title}</span>
        </nav>

        <div className="flex flex-wrap items-start gap-10">
          <div className="w-full max-w-[270px] shrink-0">
            <CoverArt
              title={comic.title}
              slug={comic.slug}
              coverKey={comic.coverKey}
              sizes="(max-width: 640px) 90vw, 270px"
              priority
              titleClassName="text-3xl"
              className="rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
            />
            <div className="mt-4 flex flex-col gap-2.5">
              {comic.chapters.length ? (
                <>
                  <Link
                    href={chapterPath(comic.slug, comic.chapters[comic.chapters.length - 1].number)}
                    className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent font-bold text-on-accent transition hover:brightness-110"
                  >
                    Start reading · Ch. {comic.chapters[comic.chapters.length - 1].number}
                  </Link>
                  {comic.chapters.length > 1 ? (
                    <Link
                      href={chapterPath(comic.slug, comic.chapters[0].number)}
                      className="flex h-11 items-center justify-center rounded-xl border border-line-strong bg-surface text-sm font-semibold transition hover:bg-surface-2"
                    >
                      Latest: Chapter {comic.chapters[0].number}
                    </Link>
                  ) : null}
                </>
              ) : null}
              {/* Per reader: loads separately so the page itself stays cached. */}
              <Suspense fallback={<div className="h-11" aria-hidden="true" />}>
                <LibraryControls comicId={comic.id} comicSlug={comic.slug} />
              </Suspense>
              {comic.chapters.length ? (
                <Suspense>
                  <ContinueReading comicId={comic.id} comicSlug={comic.slug} />
                </Suspense>
              ) : null}
            </div>
          </div>

          <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-line px-2.5 py-1 text-xs font-bold tracking-wider text-fg-soft uppercase">
                {TYPE_LABEL[comic.type]}
              </span>
              <StatusBadge status={comic.status} className="rounded-full px-2.5 py-1 text-xs" />
            </div>
            <div>
              <h1 className="font-display text-4xl leading-[1.02] font-extrabold tracking-tight sm:text-[54px]">{comic.title}</h1>
              {comic.altTitles.length ? (
                <p className="mt-2.5 text-sm text-muted">Also known as: {comic.altTitles.join(" · ")}</p>
              ) : null}
            </div>
            {comic.genres.length ? (
              <ul className="flex flex-wrap gap-2" aria-label="Genres">
                {comic.genres.map((g) => (
                  <li key={g.slug}>
                    <Link
                      href={`/genres/${g.slug}`}
                      className="flex h-9 items-center rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-medium text-fg-soft transition hover:bg-surface-2 hover:text-fg"
                    >
                      {g.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            {meta.length ? (
              <dl className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-px overflow-hidden rounded-[14px] border border-line bg-line">
                {meta.map((m) => (
                  <div key={m.label} className="bg-panel px-4 py-3.5">
                    <dt className="text-xs font-semibold text-muted">{m.label}</dt>
                    <dd className="mt-1 font-semibold">{m.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {comic.synopsis ? (
              <section aria-labelledby="synopsis-heading">
                <h2 id="synopsis-heading" className="mb-2 font-display text-xl font-bold tracking-tight">
                  Synopsis
                </h2>
                <p className="max-w-[720px] text-base leading-relaxed whitespace-pre-line text-fg-soft">{comic.synopsis}</p>
              </section>
            ) : null}
            {comic.mangaupdatesUrl ? (
              <p className="text-sm text-muted">
                Some details from{" "}
                <a href={comic.mangaupdatesUrl} target="_blank" rel="noopener noreferrer" className="text-fg-soft underline hover:text-accent-fg">
                  MangaUpdates ↗
                </a>
              </p>
            ) : null}
            {comic.officialLinks.length ? (
              <section aria-labelledby="official-heading">
                <h2 id="official-heading" className="mb-2 font-display text-xl font-bold tracking-tight">
                  Read or buy officially
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {comic.officialLinks.map((l) => (
                    <li key={l.url}>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-10 items-center rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm font-semibold transition hover:bg-surface-2"
                      >
                        {l.label} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {comic.mangadexId ? (
              <p className="text-sm text-muted">
                Title details and chapter listing via{" "}
                <a
                  href={`https://mangadex.org/title/${comic.mangadexId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fg-soft underline hover:text-accent-fg"
                >
                  MangaDex ↗
                </a>
              </p>
            ) : null}

            <section aria-labelledby="chapters-heading" className="mt-2">
              <h2 id="chapters-heading" className="mb-3 font-display text-xl font-bold tracking-tight">
                Chapters <span className="font-sans text-sm font-medium text-muted">{comic.chapterCount}</span>
              </h2>
              {comic.chapters.length ? (
                <ul className="overflow-hidden rounded-[14px] border border-line">
                  {comic.chapters.map((ch) => {
                    const row = (
                      <>
                        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                          <span className="font-semibold">Chapter {ch.number}</span>
                          {ch.title ? <span className="truncate text-sm text-muted">{ch.title}</span> : null}
                        </span>
                        {ch.isNew ? <NewBadge /> : null}
                        {ch.externalUrl ? (
                          <span className="shrink-0 text-xs font-semibold text-accent-fg">↗ {ch.groupName ?? "Official site"}</span>
                        ) : null}
                        <span className="shrink-0 text-[13px] text-muted">{ch.ago}</span>
                      </>
                    );
                    const rowClass = "flex items-center gap-3.5 bg-panel px-4 py-3.5 transition hover:bg-surface-2";
                    return (
                      <li key={ch.id} className="border-t border-line first:border-t-0">
                        {ch.externalUrl ? (
                          // Official chapter hosted by its publisher: read it there.
                          <a href={ch.externalUrl} target="_blank" rel="noopener noreferrer" className={rowClass} aria-label={`Chapter ${ch.number} on ${ch.groupName ?? "the official site"} (opens in a new tab)`}>
                            {row}
                          </a>
                        ) : (
                          <Link href={chapterPath(comic.slug, ch.number)} className={rowClass}>
                            {row}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : comic.mangadexId ? (
                <EmptyState title="No official English chapters linked yet">
                  {comic.officialLinks.length
                    ? "See “Read or buy officially” above for where this series is published."
                    : "This series is listed for discovery. Bookmark it to keep track."}
                </EmptyState>
              ) : (
                <EmptyState title="No chapters released yet" />
              )}
            </section>
          </div>
        </div>

        {comic.similar.length ? (
          <section aria-labelledby="similar-heading" className="mt-14">
            <h2 id="similar-heading" className="mb-4 font-display text-[22px] font-bold tracking-tight">
              You might also like
            </h2>
            <ComicGrid comics={comic.similar} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

// Bookmark / Favorite for logged-in readers; a login link for everyone else.
async function LibraryControls({ comicId, comicSlug }: { comicId: string; comicSlug: string }) {
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/comics/${comicSlug}`)}`}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface text-sm font-semibold transition hover:bg-surface-2"
      >
        Log in to bookmark
      </Link>
    );
  }
  return <BookmarkButtons comicId={comicId} initial={await getBookmarkState(supabase, comicId)} />;
}

// "Continue Chapter 12 · 34%" for logged-in readers who have started this
// comic. Per reader, so it loads separately from the cached page.
async function ContinueReading({ comicId, comicSlug }: { comicId: string; comicSlug: string }) {
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth) return null;

  const { data: last } = await supabase
    .from("reading_history")
    .select("progress, chapters!inner(number, deleted_at)")
    .eq("comic_id", comicId)
    .is("chapters.deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) return null;

  const number = chapterNumber(last.chapters.number) ?? "";
  const done = last.progress >= 0.95;
  return (
    <Link href={chapterPath(comicSlug, number)} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3.5 transition hover:bg-surface-2">
      <span className="flex justify-between text-[13px]">
        <span className="font-semibold">{done ? `Finished Chapter ${number}` : `Continue Chapter ${number}`}</span>
        <span className="text-muted">{Math.round(last.progress * 100)}%</span>
      </span>
      <span aria-hidden="true" className="block h-1 overflow-hidden rounded-full bg-line-strong">
        <span className="block h-full bg-accent" style={{ width: `${Math.round(last.progress * 100)}%` }} />
      </span>
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto flex max-w-[1280px] flex-wrap gap-10 px-4 pt-20 sm:px-6">
      <div className="aspect-[2/3] w-full max-w-[270px] animate-pulse rounded-2xl bg-surface motion-reduce:animate-none" />
      <div className="flex flex-[999_1_480px] flex-col gap-4">
        <div className="h-12 w-2/3 animate-pulse rounded-lg bg-surface motion-reduce:animate-none" />
        <div className="h-24 animate-pulse rounded-lg bg-surface motion-reduce:animate-none" />
        <div className="h-64 animate-pulse rounded-lg bg-surface motion-reduce:animate-none" />
      </div>
    </div>
  );
}
