import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ComicCard } from "@/components/comics/comic-card";
import { ComicGridSkeleton } from "@/components/comics/comic-card";
import { EmptyState, PageTitle } from "@/components/ui/section-heading";
import { requireUserPage } from "@/lib/auth/require-user";
import { chapterNumber, timeAgo } from "@/lib/format";
import { removeBookmark } from "../library-actions";

export const metadata: Metadata = { title: "Bookmarks", robots: { index: false } };

export default function BookmarksPage({ searchParams }: PageProps<"/bookmarks">) {
  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-8 sm:px-6">
      <PageTitle subtitle="Series you saved. Comics with new chapters come first.">Bookmarks</PageTitle>
      <Suspense fallback={<ComicGridSkeleton count={6} />}>
        <BookmarkList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BookmarkList({ searchParams }: { searchParams: PageProps<"/bookmarks">["searchParams"] }) {
  const { supabase, now } = await requireUserPage("/bookmarks");
  const favoritesOnly = (await searchParams).show === "favorites";

  let query = supabase.from("bookmarks").select("comic_id, is_favorite");
  if (favoritesOnly) query = query.eq("is_favorite", true);
  const { data: marks } = await query;
  const favorite = new Map((marks ?? []).map((m) => [m.comic_id, m.is_favorite]));
  const ids = [...favorite.keys()];

  // comic_cards only lists published comics, so unpublished ones drop out.
  const { data: cards } = ids.length
    ? await supabase
        .from("comic_cards")
        .select("id, slug, title, status, type, synopsis, cover_key, latest_chapter_number, latest_chapter_at, chapter_count, genre_names, genre_slugs")
        .in("id", ids)
        .order("latest_chapter_at", { ascending: false, nullsFirst: false })
    : { data: [] };

  const tabs = [
    { href: "/bookmarks", label: "All", active: !favoritesOnly },
    { href: "/bookmarks?show=favorites", label: "Favorites", active: favoritesOnly },
  ];

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Filter" className="flex w-fit gap-0.5 rounded-xl border border-line bg-surface p-1">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold ${t.active ? "bg-line-strong text-fg" : "text-muted hover:text-fg"}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      {cards?.length ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-4 gap-y-7 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
          {cards.map((c) => (
            <li key={c.id} className="flex flex-col gap-2">
              <ComicCard
                comic={{
                  id: c.id ?? "",
                  slug: c.slug ?? "",
                  title: c.title ?? "",
                  status: c.status ?? "ongoing",
                  type: c.type ?? "manhwa",
                  synopsis: c.synopsis ?? "",
                  coverKey: c.cover_key,
                  latestChapter: chapterNumber(c.latest_chapter_number),
                  latestAgo: timeAgo(c.latest_chapter_at, now),
                  chapterCount: c.chapter_count ?? 0,
                  genres: (c.genre_names ?? []).map((name, i) => ({ name, slug: c.genre_slugs?.[i] ?? "" })),
                }}
              />
              <div className="flex items-center justify-between gap-2 text-xs text-muted">
                <span>{favorite.get(c.id ?? "") ? "♥ Favorite" : c.latest_chapter_at ? `Updated ${timeAgo(c.latest_chapter_at, now)}` : ""}</span>
                <form action={removeBookmark.bind(null, c.id ?? "")}>
                  <button type="submit" className="font-semibold text-muted hover:text-danger" aria-label={`Remove ${c.title} from bookmarks`}>
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={favoritesOnly ? "No favorites yet" : "No bookmarks yet"}>
          {favoritesOnly ? "Tap the ♥ on a comic's page to add it here." : (
            <>
              Tap <span className="font-semibold text-fg">Bookmark</span> on any comic&apos;s page.{" "}
              <Link href="/comics" className="font-semibold text-accent-fg hover:underline">Browse comics</Link>
            </>
          )}
        </EmptyState>
      )}
    </div>
  );
}
