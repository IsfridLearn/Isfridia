import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CoverArt } from "@/components/comics/cover-art";
import { NewBadge, StatusBadge } from "@/components/comics/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, PageTitle } from "@/components/ui/section-heading";
import { parseFilters } from "@/lib/catalog/filters";
import { chapterPath } from "@/lib/chapter-path";
import { getLatestChapters } from "@/lib/catalog/queries";

export const metadata: Metadata = {
  title: "Latest updates",
  description: "The newest chapters released on Isfridia.",
};

export default function LatestPage({ searchParams }: PageProps<"/latest">) {
  return (
    <div className="mx-auto max-w-[960px] px-4 pt-8 sm:px-6">
      <PageTitle subtitle="Every new chapter, newest first.">Latest updates</PageTitle>
      <Suspense fallback={<ListSkeleton />}>
        <LatestList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LatestList({ searchParams }: { searchParams: PageProps<"/latest">["searchParams"] }) {
  const { page } = parseFilters(await searchParams);
  const result = await getLatestChapters(page);

  if (!result.items.length) {
    return <EmptyState title="No chapters yet">New chapters will be listed here as they&apos;re released.</EmptyState>;
  }

  return (
    <>
      <ul className="overflow-hidden rounded-[14px] border border-line">
        {result.items.map((item) => (
          <li key={item.id} className="border-t border-line first:border-t-0">
            <Link href={chapterPath(item.comic.slug, item.number)} className="flex items-center gap-4 bg-panel px-4 py-3 transition hover:bg-surface-2">
              <CoverArt title={item.comic.title} slug={item.comic.slug} coverKey={item.comic.cover_key} sizes="44px" decorative showTitle={false} className="w-11 shrink-0 rounded-md" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-semibold">{item.comic.title}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                  <span className="font-medium text-fg-soft">Chapter {item.number}</span>
                  {item.title ? <span className="truncate">{item.title}</span> : null}
                  {item.isNew ? <NewBadge /> : null}
                </span>
              </span>
              <span className="hidden sm:block">
                <StatusBadge status={item.comic.status} />
              </span>
              <span className="w-24 shrink-0 text-right text-sm text-muted">{item.ago}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(p) => (p > 1 ? `/latest?page=${p}` : "/latest")} />
    </>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-[90px] animate-pulse rounded-xl bg-surface motion-reduce:animate-none" />
      ))}
    </div>
  );
}
