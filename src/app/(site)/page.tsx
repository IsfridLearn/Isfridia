import Link from "next/link";
import { Suspense } from "react";
import { ComicGrid } from "@/components/comics/comic-card";
import { ContinueReadingRow } from "@/components/comics/continue-reading-row";
import { FeaturedCarousel } from "@/components/comics/featured-carousel";
import { LatestUpdateCard } from "@/components/comics/latest-update-card";
import { TrendingList } from "@/components/comics/trending-list";
import { EmptyState, SectionHeading } from "@/components/ui/section-heading";
import { getGenres, getHomeData } from "@/lib/catalog/queries";

// Homepage. All data comes from cached queries, so the whole page is built
// ahead of time and refreshed about once a minute.
export default async function HomePage() {
  const [home, genres] = await Promise.all([getHomeData(), getGenres()]);
  const hasComics = home.recent.length > 0;

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-12 px-4 pt-7 sm:px-6">
      {home.featured.length ? <FeaturedCarousel items={home.featured} /> : null}

      {/* Personal row for logged-in readers; streams in, page stays cached. */}
      <Suspense>
        <ContinueReadingRow />
      </Suspense>

      {!hasComics ? (
        <EmptyState title="No comics published yet">New series will appear here as soon as they&apos;re published.</EmptyState>
      ) : null}

      {genres.length ? (
        <section aria-labelledby="genres-heading">
          <SectionHeading id="genres-heading" href="/genres" linkLabel="All genres">
            Browse by genre
          </SectionHeading>
          <ul className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {genres.map((g) => (
              <li key={g.slug} className="shrink-0">
                <Link
                  href={`/genres/${g.slug}`}
                  className="flex h-11 items-center rounded-full border border-line-strong bg-surface px-[18px] text-sm font-medium text-fg-soft transition hover:border-faint hover:bg-surface-2 hover:text-fg"
                >
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasComics ? (
        <>
          <div className="flex flex-wrap gap-9">
            <section aria-labelledby="latest-heading" className="min-w-0 flex-[999_1_600px]">
              <SectionHeading id="latest-heading" href="/latest">
                <span aria-hidden="true" className="size-2 rounded-full bg-accent shadow-[0_0_0_4px] shadow-accent/20" />
                Latest updates
              </SectionHeading>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-3.5">
                {home.latest.map((comic) => (
                  <LatestUpdateCard key={comic.id} comic={comic} />
                ))}
              </div>
            </section>
            <aside aria-labelledby="trending-heading" className="min-w-0 flex-[1_1_300px]">
              <TrendingList lists={home.trending} />
            </aside>
          </div>

          <section aria-labelledby="popular-heading">
            <SectionHeading id="popular-heading" href="/popular">
              Popular this month
            </SectionHeading>
            <ComicGrid comics={home.popular} />
          </section>

          <section aria-labelledby="recent-heading">
            <SectionHeading id="recent-heading" href="/comics?sort=new">
              Recently added
            </SectionHeading>
            <ComicGrid comics={home.recent} />
          </section>
        </>
      ) : null}
    </div>
  );
}
